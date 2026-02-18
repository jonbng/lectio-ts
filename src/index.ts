// Public API
export { LectioClient, type LectioClientOptions } from "./client/index.js";

// Schemas & Types
export type {
	SessionInfo,
	WeekSchedule,
	ScheduleDay,
	ScheduleLesson,
	LessonStatus,
	ModuleInfo,
	Teacher,
	Room,
	Subject,
	Homework,
} from "./schemas/index.js";

// Errors
export {
	LectioError,
	AuthenticationError,
	SessionExpiredError,
	NetworkError,
	ParseError,
} from "./errors/index.js";

// Parsers (for advanced usage / offline testing)
export { parseSchedule } from "./parsers/index.js";
export { parseAuthState } from "./parsers/index.js";

// Session utilities (for advanced usage)
export { extractAspNetFields, buildPostbackData } from "./session/index.js";
