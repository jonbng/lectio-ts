import { AuthenticationError } from "../errors/index.js";
import { parseAuthState } from "../parsers/auth.js";
import { parseSchedule } from "../parsers/schedule.js";
import type { WeekSchedule } from "../schemas/schedule.js";
import type { SessionInfo } from "../schemas/session.js";
import { Session } from "../session/session.js";
import { createLogger, type Logger } from "../utils/debug.js";

export interface LectioClientOptions {
	schoolId: number;
	autologinKey: string;
	debug?: boolean;
	/** Override the fetch implementation (useful for testing). */
	fetch?: (url: string, init?: Record<string, unknown>) => Promise<Response>;
}

export class LectioClient {
	private readonly session: Session;
	private readonly log: Logger;
	private sessionInfo: SessionInfo | null = null;

	constructor(options: LectioClientOptions) {
		this.session = new Session({
			schoolId: options.schoolId,
			autologinKey: options.autologinKey,
			debug: options.debug,
			fetch: options.fetch as never,
		});
		this.log = createLogger(options.debug ?? false);
	}

	/**
	 * Establishes the session by making an initial request to Lectio.
	 * The autologin cookie triggers Lectio to issue session cookies.
	 * Verifies authentication by parsing the response for the student/teacher identity.
	 */
	async connect(): Promise<SessionInfo> {
		this.log.log("Connecting to Lectio...");

		const response = await this.session.get("forside.aspx");
		const info = parseAuthState(response.html, this.session.schoolId);

		if (!info) {
			throw new AuthenticationError(
				"Failed to authenticate: autologin key may be invalid or expired",
				{ url: response.url },
			);
		}

		this.sessionInfo = info;
		this.session.markAuthenticated();
		this.log.log(`Connected as ${info.isTeacher ? "teacher" : "student"} ${info.studentId}`);

		return info;
	}

	/**
	 * Fetches the weekly schedule.
	 * Optionally specify a week (ISO format like "502025") and/or a specific student ID.
	 */
	async getSchedule(options?: { week?: string; studentId?: string }): Promise<WeekSchedule> {
		const params: Record<string, string> = {};
		if (options?.week) params.week = options.week;

		const studentId = options?.studentId ?? this.sessionInfo?.studentId;
		if (studentId) {
			params.type = "elev";
			params.elevid = studentId;
		}

		const response = await this.session.get("SkemaNy.aspx", params);
		return parseSchedule(response.html);
	}

	/**
	 * Returns the session identity if connected, or null if not yet connected.
	 */
	getSessionInfo(): SessionInfo | null {
		return this.sessionInfo;
	}
}
