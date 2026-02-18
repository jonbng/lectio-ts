import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LectioClient } from "@/client/lectio-client.js";
import { SessionExpiredError } from "@/errors/index.js";
import { describe, expect, it, vi } from "vitest";

const fixturesDir = join(__dirname, "../fixtures");

function loadFixture(name: string): string {
	return readFileSync(join(fixturesDir, name), "utf-8");
}

/**
 * Create a Response with `.url` set (standard `new Response()` doesn't set it,
 * but fetch-cookie needs it to store cookies against the correct domain).
 */
function mockResponse(url: string, body: string, init?: ResponseInit): Response {
	const res = new Response(body, init);
	Object.defineProperty(res, "url", { value: url, writable: false });
	return res;
}

function createMockFetch(behavior: "valid" | "invalid" | "expires-then-recovers") {
	let callCount = 0;

	return vi.fn(async (url: string, _init?: Record<string, unknown>) => {
		callCount++;
		const urlStr = String(url);

		if (behavior === "valid") {
			if (urlStr.includes("forside.aspx")) {
				return mockResponse(urlStr, loadFixture("forside.html"), {
					status: 200,
					headers: {
						"content-type": "text/html; charset=utf-8",
						"set-cookie": "ASP.NET_SessionId=abc123; path=/; HttpOnly",
					},
				});
			}
			if (urlStr.includes("SkemaNy.aspx")) {
				return mockResponse(urlStr, loadFixture("schedule.html"), {
					status: 200,
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}
		}

		if (behavior === "invalid") {
			return mockResponse(urlStr, loadFixture("login-redirect.html"), {
				status: 200,
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}

		if (behavior === "expires-then-recovers") {
			if (callCount <= 1) {
				return mockResponse(urlStr, loadFixture("login-redirect.html"), {
					status: 200,
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}
			return mockResponse(urlStr, loadFixture("forside.html"), {
				status: 200,
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}

		return mockResponse(urlStr, "Not found", { status: 404 });
	});
}

describe("LectioClient session flow", () => {
	it("connects successfully with a valid autologin key", async () => {
		const mockFetch = createMockFetch("valid");
		const client = new LectioClient({
			schoolId: 94,
			autologinKey: "valid-key",
			fetch: mockFetch,
		});

		const info = await client.connect();

		expect(info.studentId).toBe("72721772841");
		expect(info.schoolId).toBe(94);
		expect(info.isTeacher).toBe(false);
		expect(mockFetch).toHaveBeenCalled();
	});

	it("throws AuthenticationError with an invalid key", async () => {
		const mockFetch = createMockFetch("invalid");
		const client = new LectioClient({
			schoolId: 94,
			autologinKey: "invalid-key",
			fetch: mockFetch,
		});

		// Invalid key -> login page is returned -> session expired -> auto-refresh also fails
		// -> SessionExpiredError (because the retry also gets login page)
		await expect(client.connect()).rejects.toThrow(SessionExpiredError);
	});

	it("fetches a schedule after connecting", async () => {
		const mockFetch = createMockFetch("valid");
		const client = new LectioClient({
			schoolId: 94,
			autologinKey: "valid-key",
			fetch: mockFetch,
		});

		await client.connect();
		const schedule = await client.getSchedule();

		expect(schedule.weekNumber).toBe(50);
		expect(schedule.year).toBe(2025);
		expect(schedule.days.length).toBeGreaterThan(0);
	});

	it("auto-refreshes an expired session", async () => {
		const mockFetch = createMockFetch("expires-then-recovers");
		const client = new LectioClient({
			schoolId: 94,
			autologinKey: "valid-key",
			fetch: mockFetch,
		});

		const info = await client.connect();

		expect(info.studentId).toBe("72721772841");
		// Should have called fetch twice: once expired, once recovered
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it("returns session info after connect", async () => {
		const mockFetch = createMockFetch("valid");
		const client = new LectioClient({
			schoolId: 94,
			autologinKey: "valid-key",
			fetch: mockFetch,
		});

		expect(client.getSessionInfo()).toBeNull();
		await client.connect();

		const info = client.getSessionInfo();
		expect(info).not.toBeNull();
		expect(info?.studentId).toBe("72721772841");
	});
});
