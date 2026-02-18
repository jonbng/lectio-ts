import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isLoginPageHtml, parseAuthState } from "@/parsers/auth.js";

const fixturesDir = join(__dirname, "../../fixtures");

function loadFixture(name: string): string {
	return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("parseAuthState", () => {
	it("extracts student ID from an authenticated forside page", () => {
		const html = loadFixture("forside.html");
		const result = parseAuthState(html, 94);

		expect(result).not.toBeNull();
		expect(result?.studentId).toBe("72721772841");
		expect(result?.schoolId).toBe(94);
		expect(result?.isTeacher).toBe(false);
	});

	it("extracts student ID from an authenticated schedule page", () => {
		const html = loadFixture("schedule.html");
		const result = parseAuthState(html, 94);

		expect(result).not.toBeNull();
		expect(result?.studentId).toBe("72721772841");
		expect(result?.isTeacher).toBe(false);
	});

	it("returns null for a login page", () => {
		const html = loadFixture("login-redirect.html");
		const result = parseAuthState(html, 94);

		expect(result).toBeNull();
	});
});

describe("isLoginPageHtml", () => {
	it("detects a login page", () => {
		const html = loadFixture("login-redirect.html");
		expect(isLoginPageHtml(html)).toBe(true);
	});

	it("does not flag an authenticated page as login", () => {
		const html = loadFixture("forside.html");
		expect(isLoginPageHtml(html)).toBe(false);
	});
});
