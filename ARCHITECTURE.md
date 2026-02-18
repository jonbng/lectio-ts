# Architecture

This document describes the internal structure and design decisions of lectio-ts.

## Overview

```
lectio-ts/
├── src/
│   ├── client/           # Public API layer
│   ├── session/          # HTTP session management
│   ├── parsers/          # HTML parsing logic
│   ├── selectors/        # CSS selectors & regex patterns
│   ├── schemas/          # Zod schemas & TypeScript types
│   ├── errors/           # Custom error hierarchy
│   ├── utils/            # Shared utilities
│   └── index.ts          # Public exports
├── tests/
│   ├── unit/             # Parser & utility tests
│   ├── integration/      # Session flow tests (MSW)
│   └── fixtures/         # HTML test fixtures
├── scripts/
│   └── schedule-demo.ts  # CLI demo script
└── reference/            # Raw HTML samples for development
```

## Design Principles

### 1. Separation of Concerns

The codebase is organized into distinct layers:

- **Client** (`src/client/`) – Public API that consumers interact with
- **Session** (`src/session/`) – Low-level HTTP and cookie management
- **Parsers** (`src/parsers/`) – Pure functions that transform HTML into typed data
- **Selectors** (`src/selectors/`) – Centralized CSS selectors and regex patterns

This separation allows parsers to be tested in isolation with HTML fixtures, and makes it easy to adapt to Lectio HTML changes by updating selectors without touching business logic.

### 2. Token-Only Authentication

Unlike username/password auth, this library uses Lectio's autologin mechanism:

1. The `autologinkeyV2` cookie is seeded into a cookie jar
2. Any request to Lectio triggers automatic session establishment
3. Lectio issues `ASP.NET_SessionId` cookies in response
4. The session is validated by checking for authenticated user info in the HTML

This approach is simpler and avoids dealing with Lectio's complex ASP.NET WebForms postback authentication.

### 3. Automatic Session Refresh

Sessions can expire. The `Session` class detects expiration by:
- Checking if the response URL is a login page
- Looking for login indicators in the HTML

When expiration is detected, it automatically:
1. Clears stale session cookies
2. Re-seeds the autologin cookie
3. Retries the original request

This happens transparently to the consumer.

## Module Details

### `src/client/lectio-client.ts`

The main entry point. `LectioClient` orchestrates:
- Session creation and configuration
- Authentication via `connect()`
- High-level API methods like `getSchedule()`

```typescript
const client = new LectioClient({ schoolId, autologinKey });
await client.connect();
const schedule = await client.getSchedule({ week: "082025" });
```

### `src/session/session.ts`

Manages HTTP requests with a persistent cookie jar:

- Uses `undici` for HTTP requests (better performance than Node's built-in fetch)
- Uses `tough-cookie` for RFC-compliant cookie handling
- Uses `fetch-cookie` to wrap fetch with automatic cookie management
- Seeds autologin cookies before first request
- Detects session expiration and auto-refreshes

Key methods:
- `get(path, params?)` – GET request to Lectio
- `post(path, body)` – POST request (for ASP.NET postbacks)
- `buildUrl(path, params?)` – Constructs full Lectio URLs

### `src/session/asp-net.ts`

Utilities for ASP.NET WebForms interaction:

- `extractAspNetFields(html)` – Extracts `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`
- `buildPostbackData(fields, target)` – Builds form data for ASP.NET postbacks

### `src/parsers/`

Pure parsing functions that take HTML and return typed data:

- **`auth.ts`** – `parseAuthState(html, schoolId)` extracts session info (student ID, teacher flag)
- **`schedule.ts`** – `parseSchedule(html)` extracts the full week schedule

Parsers use Cheerio for DOM traversal and selectors from `src/selectors/`.

### `src/selectors/`

Centralized selectors and patterns, organized by feature:

- **`schedule.selectors.ts`** – CSS selectors for schedule tables, lesson blocks, module info
- **`common.selectors.ts`** – Shared selectors for auth detection

Selectors are exported as `const` objects for type safety and easy refactoring.

### `src/schemas/`

Zod schemas that define the shape of all data structures:

- **`session.ts`** – `SessionInfoSchema`
- **`schedule.ts`** – `WeekScheduleSchema`, `ScheduleDaySchema`, `ScheduleLessonSchema`
- **`common.ts`** – `TeacherSchema`, `RoomSchema`, `SubjectSchema`, `HomeworkSchema`

TypeScript types are inferred from schemas using `z.infer<>`.

### `src/errors/`

Custom error hierarchy for meaningful error handling:

```
LectioError
├── AuthenticationError    # Invalid/expired autologin key
├── SessionExpiredError    # Session expired, auto-refresh failed
├── NetworkError           # HTTP request failed
└── ParseError             # HTML parsing failed
```

All errors include contextual information like URL, status code, and CSS selector (for parse errors).

### `src/utils/`

Shared utilities:

- **`html.ts`** – Cheerio wrapper (`loadHtml`)
- **`url.ts`** – URL building (`buildLectioUrl`, `isLoginPage`)
- **`debug.ts`** – Conditional logging (`createLogger`)

## Testing Strategy

### Unit Tests (`tests/unit/`)

Test parsers in isolation using HTML fixtures:

```typescript
import { parseSchedule } from "../../src/parsers/schedule.js";
import fixture from "../fixtures/schedule.html?raw";

test("parses schedule correctly", () => {
  const result = parseSchedule(fixture);
  expect(result.weekNumber).toBe(8);
});
```

### Integration Tests (`tests/integration/`)

Test the full session flow using MSW (Mock Service Worker):

```typescript
const server = setupServer(
  http.get("https://www.lectio.dk/lectio/94/forside.aspx", () => {
    return HttpResponse.html(authenticatedHtml);
  })
);

test("session establishes correctly", async () => {
  const client = new LectioClient({ schoolId: 94, autologinKey: "test" });
  const info = await client.connect();
  expect(info.studentId).toBeDefined();
});
```

### Fixtures (`tests/fixtures/`)

Representative HTML samples captured from Lectio, used for:
- Unit testing parsers
- Documenting expected HTML structure
- Regression testing when Lectio changes their HTML

## Build & Tooling

- **Bun** – Package manager and runtime
- **tsup** – Builds ESM and CJS bundles
- **Vitest** – Test runner
- **Biome** – Linter and formatter
- **TypeScript** – Type checking

Output formats:
- `dist/index.js` – ESM bundle
- `dist/index.cjs` – CommonJS bundle
- `dist/index.d.ts` – Type declarations

## Extending the Library

### Adding a New Endpoint

1. Add CSS selectors to `src/selectors/`
2. Create a parser in `src/parsers/`
3. Add schemas to `src/schemas/`
4. Add a method to `LectioClient`
5. Export types from `src/index.ts`
6. Add fixtures and tests

### Handling Lectio HTML Changes

When Lectio changes their HTML structure:

1. Capture new HTML samples in `reference/`
2. Update selectors in `src/selectors/`
3. Update parsers if structure changed significantly
4. Update fixtures and tests
5. Run full test suite to verify
