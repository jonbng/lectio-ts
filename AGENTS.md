# Working with lectio-ts (AI Agent Guide)

This document provides guidance for AI assistants working with the lectio-ts codebase.

## Quick Context

**What this is:** A TypeScript library for Lectio (Danish school LMS). No official API exists, so this library scrapes HTML and uses authenticated HTTP requests.

**Auth model:** Token-only. Users provide `schoolId` and `autologinKey` (the `autologinkeyV2` cookie from Lectio). No username/password handling.

**Runtime:** Bun preferred, but works with Node.js. Uses ESM modules exclusively.

## Critical Things to Remember

### 1. Lectio Has No API

All data comes from scraping HTML. This means:
- Selectors and parsers are fragile to HTML changes
- Always check if selectors in `src/selectors/` still match current Lectio HTML
- When debugging, capture actual HTML responses for comparison

### 2. ASP.NET WebForms Complexity

Lectio uses ASP.NET WebForms with:
- `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION` hidden fields
- Postback patterns for form submissions
- Session cookies that expire

The `src/session/asp-net.ts` module handles postback data extraction. Use it for any POST operations.

### 3. Authentication Flow

```
1. Seed autologinkeyV2 + isloggedin3 cookies
2. GET any Lectio page → Lectio issues ASP.NET_SessionId
3. Parse HTML for user identity (studentId, isTeacher)
4. Session established
```

Session expiration is detected automatically and triggers re-authentication.

### 4. Selector-First Architecture

**Before writing parsing logic, check existing selectors:**
- `src/selectors/schedule.selectors.ts` – Schedule-related selectors
- `src/selectors/common.selectors.ts` – Auth detection selectors

**When Lectio HTML changes:**
1. Update selectors first
2. Parsers should "just work" if selectors are correct
3. Add new regex patterns to selector files, not parsers

### 5. Schema-Driven Types

All types are derived from Zod schemas in `src/schemas/`:
```typescript
// Schema defined in src/schemas/schedule.ts
export const ScheduleLessonSchema = z.object({ ... });

// Type inferred from schema
export type ScheduleLesson = z.infer<typeof ScheduleLessonSchema>;
```

**Do not create types manually.** Always define the schema first.

## Common Tasks

### Adding a New Lectio Feature

1. **Capture HTML** – Use browser DevTools to save the relevant page HTML to `reference/`
2. **Create selectors** – Add CSS selectors and regex patterns to `src/selectors/`
3. **Create parser** – Add pure parsing function to `src/parsers/`
4. **Define schema** – Add Zod schema to `src/schemas/`
5. **Add client method** – Expose via `LectioClient` in `src/client/`
6. **Export publicly** – Update `src/index.ts`
7. **Test** – Add fixtures to `tests/fixtures/`, write unit tests

### Debugging Authentication Issues

1. Check if `autologinKey` is valid (they expire eventually)
2. Enable debug mode: `new LectioClient({ ..., debug: true })`
3. Look for redirect to login page (indicates session expiration)
4. Check if `parseAuthState` finds user identity in HTML

### Debugging Parse Errors

1. Get the actual HTML response (use debug mode)
2. Check if selectors match using browser DevTools
3. Compare against fixtures in `tests/fixtures/`
4. Update selectors if Lectio changed their HTML

### Running Tests

```bash
bun test              # Run all tests
bun test:watch        # Watch mode
bun run typecheck     # Type checking
bun run lint          # Linting
bun run check         # Lint + format
```

### Building

```bash
bun run build         # Build to dist/
```

## Code Style Guidelines

### Imports

Use `.js` extensions for all relative imports (required for ESM):
```typescript
import { parseSchedule } from "./parsers/schedule.js";
```

### Error Handling

Always use the custom error classes from `src/errors/`:
```typescript
throw new ParseError("Could not find schedule table", {
  selector: SCHEDULE_SELECTORS.table,
  url: response.url,
});
```

### Pure Parsers

Parsers should be pure functions that take HTML and return typed data:
```typescript
export function parseSchedule(html: string): WeekSchedule {
  const $ = loadHtml(html);
  // ... parsing logic
  return { weekNumber, year, days, modules };
}
```

No side effects, no HTTP calls, no state.

### Logging

Use the debug logger, not `console.log`:
```typescript
const log = createLogger(options.debug ?? false);
log.log("Fetching schedule...");
log.warn("Session expired, refreshing...");
```

## File Reference

| Path | Purpose |
|------|---------|
| `src/client/lectio-client.ts` | Main public API class |
| `src/session/session.ts` | HTTP session with cookie jar |
| `src/session/asp-net.ts` | ASP.NET WebForms helpers |
| `src/parsers/auth.ts` | Auth state parser |
| `src/parsers/schedule.ts` | Schedule parser |
| `src/selectors/*.ts` | CSS selectors and regex patterns |
| `src/schemas/*.ts` | Zod schemas and types |
| `src/errors/index.ts` | Custom error classes |
| `tests/fixtures/` | HTML test fixtures |
| `reference/` | Raw HTML samples for development |

## Common Pitfalls

1. **Forgetting `.js` in imports** – ESM requires explicit extensions
2. **Creating types without schemas** – Always define Zod schema first
3. **Hardcoding selectors in parsers** – Put them in `src/selectors/`
4. **Using console.log** – Use `createLogger` instead
5. **Not handling session expiration** – The Session class handles this automatically
6. **Assuming stable HTML** – Lectio can change their HTML at any time

## Testing Real Requests

Use the demo script to test with real credentials:
```bash
LECTIO_SCHOOL_ID=94 LECTIO_AUTOLOGIN_KEY=your-key bun run schedule
```

Add `DEBUG=1` for verbose output:
```bash
DEBUG=1 LECTIO_SCHOOL_ID=94 LECTIO_AUTOLOGIN_KEY=your-key bun run schedule
```
