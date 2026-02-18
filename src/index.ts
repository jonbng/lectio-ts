// Public API
export { LectioClient, type LectioClientOptions } from "./client/index.js";
// Errors
export {
	AuthenticationError,
	LectioError,
	NetworkError,
	ParseError,
	SessionExpiredError,
} from "./errors/index.js";
// Parsers (for advanced usage / offline testing)
export { parseAuthState, parseSchedule } from "./parsers/index.js";
// Schemas & Types
export type {
	Homework,
	LessonStatus,
	ModuleInfo,
	Room,
	ScheduleDay,
	ScheduleLesson,
	SessionInfo,
	Subject,
	Teacher,
	WeekSchedule,
} from "./schemas/index.js";

// Session utilities (for advanced usage)
export { buildPostbackData, extractAspNetFields } from "./session/index.js";
