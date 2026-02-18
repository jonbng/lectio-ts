import type { SessionInfo } from "../schemas/session.js";
import { AUTH_PATTERNS, COMMON_SELECTORS } from "../selectors/common.selectors.js";
import { loadHtml } from "../utils/html.js";

/**
 * Parses an authenticated Lectio page to extract session identity.
 * Looks for the `msapplication-starturl` meta tag which contains the
 * student/teacher ID when the page belongs to an authenticated session.
 *
 * Returns null if the page does not appear to be authenticated.
 */
export function parseAuthState(html: string, schoolId: number): SessionInfo | null {
	const $ = loadHtml(html);

	const metaEl = $(COMMON_SELECTORS.authMeta);
	if (metaEl.length === 0) return null;

	const content = metaEl.attr("content");
	if (!content) return null;

	const elevMatch = content.match(AUTH_PATTERNS.elevIdParam);
	if (elevMatch) {
		return { studentId: elevMatch[1], schoolId, isTeacher: false };
	}

	const teacherMatch = content.match(AUTH_PATTERNS.teacherIdParam);
	if (teacherMatch) {
		return { studentId: teacherMatch[1], schoolId, isTeacher: true };
	}

	return null;
}

/**
 * Quick check: does this HTML look like a login page rather than
 * an authenticated page?
 */
export function isLoginPageHtml(html: string): boolean {
	return (
		AUTH_PATTERNS.loginPageIndicator.test(html.slice(0, 5000)) &&
		!html.includes("msapplication-starturl")
	);
}
