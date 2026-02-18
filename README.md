# lectio-ts

A TypeScript library for integrating with [Lectio](https://lectio.dk), the Danish school LMS platform.

> **Note:** Lectio has no official API. This library uses HTML scraping and authenticated HTTP requests to interact with the platform.

## Features

- Token-based authentication using Lectio's `autologinkeyV2` cookie
- Persistent cookie jar with automatic session refresh
- Schedule fetching with full lesson details (subject, teacher, room, status)
- Typed responses with Zod schemas
- Works in Node.js and Bun

## Installation

```bash
# npm
npm install lectio-ts

# bun
bun add lectio-ts
```

## Quick Start

```typescript
import { LectioClient } from "lectio-ts";

const client = new LectioClient({
  schoolId: 94,                    // Your school's Lectio ID
  autologinKey: "your-key-here",   // Value of autologinkeyV2 cookie
  debug: false,                    // Optional: enable debug logging
});

// Establish session
const session = await client.connect();
console.log(`Connected as ${session.isTeacher ? "teacher" : "student"}`);

// Fetch this week's schedule
const schedule = await client.getSchedule();

for (const day of schedule.days) {
  console.log(`${day.dayName} ${day.date}`);
  for (const lesson of day.items) {
    console.log(`  ${lesson.startTime}-${lesson.endTime} ${lesson.subject?.name}`);
  }
}
```

## Getting Your Autologin Key

1. Log in to Lectio in your browser
2. Open DevTools → Application → Cookies
3. Find the `autologinkeyV2` cookie for `www.lectio.dk`
4. Copy its value

The autologin key is a long-lived token that Lectio uses for "remember me" functionality.

## API Reference

### `LectioClient`

```typescript
const client = new LectioClient({
  schoolId: number;         // Required: school ID from Lectio URL
  autologinKey: string;     // Required: autologinkeyV2 cookie value
  debug?: boolean;          // Optional: enable debug logging
  fetch?: FetchFn;          // Optional: custom fetch implementation
});
```

#### `client.connect(): Promise<SessionInfo>`

Establishes the authenticated session. Must be called before other methods.

Returns:
```typescript
{
  studentId: string;
  isTeacher: boolean;
}
```

#### `client.getSchedule(options?): Promise<WeekSchedule>`

Fetches the weekly schedule.

Options:
```typescript
{
  week?: string;      // Week in format "WW2025" (e.g., "082025")
  studentId?: string; // Override the student ID
}
```

Returns a `WeekSchedule` with days, lessons, and module information.

### Types

```typescript
interface WeekSchedule {
  weekNumber: number;
  year: number;
  days: ScheduleDay[];
  modules: ModuleInfo[];
}

interface ScheduleDay {
  date: string;           // ISO date "2025-02-17"
  dayName: string;        // "Mandag", "Tirsdag", etc.
  items: ScheduleLesson[];
  isWeekend: boolean;
}

interface ScheduleLesson {
  activityId?: string;
  subject?: { name: string; code?: string };
  teacher?: { name: string; initials: string };
  room?: { name: string };
  startTime?: string;     // "08:10"
  endTime?: string;       // "09:40"
  date: string;
  status: "normal" | "changed" | "cancelled";
  title?: string;
  topic?: string;
  homework?: { description: string }[];
  notes?: string;
}
```

### Errors

All errors extend `LectioError`:

- `AuthenticationError` – Invalid or expired autologin key
- `SessionExpiredError` – Session expired (auto-refresh failed)
- `NetworkError` – HTTP request failed
- `ParseError` – Failed to parse Lectio HTML

## Demo CLI

A demo script is included to test the library:

```bash
LECTIO_SCHOOL_ID=94 LECTIO_AUTOLOGIN_KEY=your-key bun run schedule
```

Or with debug output:

```bash
DEBUG=1 LECTIO_SCHOOL_ID=94 LECTIO_AUTOLOGIN_KEY=your-key bun run schedule
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Lint & format
bun run check

# Build
bun run build
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details on how the codebase is structured.

## License

MIT
