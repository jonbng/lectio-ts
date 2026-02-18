import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPostbackData, extractAspNetFields } from "@/session/asp-net.js";

const fixturesDir = join(__dirname, "../../fixtures");

function loadFixture(name: string): string {
	return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("extractAspNetFields", () => {
	it("extracts VIEWSTATEX from a real page", () => {
		const html = loadFixture("forside.html");
		const fields = extractAspNetFields(html);

		expect(fields.__VIEWSTATEX).toBeDefined();
		expect(fields.__VIEWSTATEX.length).toBeGreaterThan(10);
	});

	it("extracts VIEWSTATE and VIEWSTATEY_KEY", () => {
		const html = loadFixture("forside.html");
		const fields = extractAspNetFields(html);

		expect("__VIEWSTATE" in fields).toBe(true);
		expect("__VIEWSTATEY_KEY" in fields).toBe(true);
	});

	it("extracts EVENTARGUMENT", () => {
		const html = loadFixture("forside.html");
		const fields = extractAspNetFields(html);

		// __EVENTARGUMENT is extracted from hidden inputs
		expect("__EVENTARGUMENT" in fields).toBe(true);
		// __EVENTTARGET is NOT extracted - it's set dynamically via buildPostbackData
	});

	it("extracts SCROLLPOSITION", () => {
		const html = loadFixture("schedule.html");
		const fields = extractAspNetFields(html);

		expect("__SCROLLPOSITION" in fields).toBe(true);
	});
});

describe("buildPostbackData", () => {
	it("merges ASP.NET fields with event target", () => {
		const fields = {
			__VIEWSTATEX: "abc",
			__VIEWSTATE: "",
		};

		const result = buildPostbackData(fields, "some$target");

		expect(result.__EVENTTARGET).toBe("some$target");
		expect(result.__VIEWSTATEX).toBe("abc");
		expect(result.__VIEWSTATE).toBe("");
	});

	it("includes extra fields", () => {
		const result = buildPostbackData({ __VIEWSTATEX: "v" }, "target", { m$Content$field: "value" });

		expect(result.m$Content$field).toBe("value");
		expect(result.__EVENTTARGET).toBe("target");
	});
});
