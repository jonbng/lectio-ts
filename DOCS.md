# Using lectio-ts

This guide explains how to use the lectio-ts library in your application.

For a quick overview and API summary, see [README.md](./README.md).

---

## Setup

### Installation

```bash
npm install lectio-ts
# or
bun add lectio-ts
```

### Credentials

You need two values:

1. **School ID** – The number in your Lectio URL, e.g. `https://www.lectio.dk/lectio/94/...` → school ID is `94`.
2. **Autologin key** – The value of the `autologinkeyV2` cookie:
   - Log in to Lectio in your browser.
   - Open DevTools → Application (or Storage) → Cookies → `https://www.lectio.dk`.
   - Find `autologinkeyV2` and copy its value.

The autologin key is long-lived (Lectio’s “remember me” token). Keep it secret like a password.

### Creating a client

```typescript
import { LectioClient } from "lectio-ts";

const client = new LectioClient({
  schoolId: 94,
  autologinKey: process.env.LECTIO_AUTOLOGIN_KEY!,
  debug: process.env.NODE_ENV !== "production",
});
```

Prefer reading credentials from environment variables so you never commit them.

---

## Basic usage

### 1. Connect

Establish the session before calling any other API:

```typescript
const session = await client.connect();

console.log(session.studentId);   // e.g. "1234567890"
console.log(session.isTeacher);   // true or false
```

If the autologin key is invalid or expired, `connect()` throws `AuthenticationError`.

### 2. Fetch the schedule

Get the default (current) week for the logged-in user:

```typescript
const schedule = await client.getSchedule();
```

Get a specific week:

```typescript
// Week format: "WWYYYY" (two-digit week, four-digit year)
const schedule = await client.getSchedule({ week: "082025" });
```

Get the schedule for another student (e.g. if you’re a teacher or parent):

```typescript
const schedule = await client.getSchedule({
  week: "082025",
  studentId: "9876543210",
});
```

You must call `connect()` first; otherwise `getSchedule()` may not have a student ID for the default case.

---

## Working with schedule data

### Structure

- `schedule.weekNumber` – ISO week number (1–53).
- `schedule.year` – Year.
- `schedule.days` – Array of days in the week (Monday–Sunday).
- `schedule.modules` – Module (time block) definitions, e.g. “1. modul 08:10–09:40”.

Each day has:

- `date` – ISO date string (`YYYY-MM-DD`).
- `dayName` – Danish name (Mandag, Tirsdag, …).
- `items` – Array of lessons.
- `isWeekend` – `true` for Saturday/Sunday.

Each lesson has (all optional except where noted):

- `startTime`, `endTime` – e.g. `"08:10"`, `"09:40"`.
- `subject` – `{ name, code? }`.
- `teacher` – `{ name, initials }`.
- `room` – `{ name }`.
- `date` – Date string (always present).
- `status` – `"normal"` | `"changed"` | `"cancelled"`.
- `title`, `topic`, `homework`, `notes` – when available.

### Example: Print a simple week overview

```typescript
const schedule = await client.getSchedule();

for (const day of schedule.days) {
  console.log(`${day.dayName} ${day.date}`);
  for (const lesson of day.items) {
    const time = lesson.startTime && lesson.endTime
      ? `${lesson.startTime}–${lesson.endTime}`
      : "—";
    const subject = lesson.subject?.name ?? "?";
    const room = lesson.room?.name ?? "—";
    const status = lesson.status === "cancelled" ? " [AFLYST]" : "";
    console.log(`  ${time}  ${subject}  ·  ${room}${status}`);
  }
}
```

### Example: Only weekdays

```typescript
const weekdays = schedule.days.filter((d) => !d.isWeekend);
```

### Example: Find cancelled lessons

```typescript
const cancelled = schedule.days.flatMap((day) =>
  day.items.filter((l) => l.status === "cancelled")
);
```

### Example: Group by subject

```typescript
const bySubject = new Map<string, ScheduleLesson[]>();

for (const day of schedule.days) {
  for (const lesson of day.items) {
    const name = lesson.subject?.name ?? "Ukendt";
    if (!bySubject.has(name)) bySubject.set(name, []);
    bySubject.get(name)!.push(lesson);
  }
}
```

### Week parameter format

Use **two-digit week + four-digit year**, e.g. `"082025"` for week 8 of 2025. Leading zero is required for weeks 1–9.

Helper to get the current week:

```typescript
function getCurrentWeekParam(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${String(week).padStart(2, "0")}${now.getFullYear()}`;
}

const schedule = await client.getSchedule({ week: getCurrentWeekParam() });
```

(For strict ISO week numbers you may prefer a small library like `date-fns` with `getISOWeek`.)

---

## Error handling

All thrown errors extend `LectioError` and may include `url` and, where relevant, `statusCode` or `selector`.

### Handling specific errors

```typescript
import {
  LectioClient,
  AuthenticationError,
  SessionExpiredError,
  NetworkError,
  ParseError,
} from "lectio-ts";

try {
  await client.connect();
  const schedule = await client.getSchedule();
  // ...
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error("Invalid or expired autologin key. Please log in again and copy a new key.");
    return;
  }
  if (err instanceof SessionExpiredError) {
    console.error("Session expired and could not be refreshed.");
    return;
  }
  if (err instanceof NetworkError) {
    console.error("Network error:", err.message, err.url);
    return;
  }
  if (err instanceof ParseError) {
    console.error("Lectio’s page structure may have changed:", err.message, err.selector);
    return;
  }
  throw err;
}
```

### Checking error properties

```typescript
if (err instanceof LectioError) {
  console.error(err.name, err.message);
  if (err.url) console.error("URL:", err.url);
  if (err.cause) console.error("Cause:", err.cause);
}
```

---

## Security and configuration

### Storing credentials

- **Do not** hardcode the autologin key or commit it.
- Use environment variables (e.g. `LECTIO_SCHOOL_ID`, `LECTIO_AUTOLOGIN_KEY`) or a secrets manager.
- In server apps, pass the key from your config into `LectioClient` at runtime.

### Debug mode

With `debug: true`, the client logs request URLs and response sizes. Use it only in development:

```typescript
const client = new LectioClient({
  schoolId,
  autologinKey,
  debug: process.env.NODE_ENV !== "production",
});
```

---

## Advanced usage

### Custom fetch (e.g. testing or proxies)

You can inject a custom fetch implementation:

```typescript
const client = new LectioClient({
  schoolId: 94,
  autologinKey: "key",
  fetch: myCustomFetch,
});
```

The client uses this for all HTTP requests. Cookie handling is still done by the library via the session.

### Using parsers directly

If you have HTML (e.g. from a cache or another source), you can use the parsers without the client:

```typescript
import { parseSchedule, parseAuthState } from "lectio-ts";

const schedule = parseSchedule(htmlString);
const sessionInfo = parseAuthState(htmlString, schoolId);
```

Use this for offline testing, custom caching, or custom HTTP layers.

### Using session utilities

For advanced ASP.NET WebForms flows (e.g. custom postbacks), the session helpers are exported:

```typescript
import { extractAspNetFields, buildPostbackData } from "lectio-ts";
```

See the source and [ARCHITECTURE.md](./ARCHITECTURE.md) for how they are used internally.

---

## TypeScript

All main types are exported:

```typescript
import type {
  WeekSchedule,
  ScheduleDay,
  ScheduleLesson,
  SessionInfo,
  LessonStatus,
  ModuleInfo,
  Subject,
  Teacher,
  Room,
  Homework,
} from "lectio-ts";
```

Lesson fields like `subject`, `teacher`, and `room` are optional because Lectio does not always provide them. Use optional chaining:

```typescript
const name = lesson.subject?.name ?? "Ukendt";
const room = lesson.room?.name ?? "—";
```

---

## Demo script

The repo includes a CLI that fetches the current week and prints it to the console:

```bash
LECTIO_SCHOOL_ID=94 LECTIO_AUTOLOGIN_KEY=your-key bun run schedule
```

With debug output:

```bash
DEBUG=1 LECTIO_SCHOOL_ID=94 LECTIO_AUTOLOGIN_KEY=your-key bun run schedule
```

Use it to verify credentials and see the shape of the data.

---

## Further reading

- [README.md](./README.md) – Overview and API reference.
- [ARCHITECTURE.md](./ARCHITECTURE.md) – How the library is built and tested.
