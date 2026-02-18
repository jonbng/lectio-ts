import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSchedule } from "@/parsers/schedule.js";

const fixturesDir = join(__dirname, "../../fixtures");

function loadFixture(name: string): string {
	return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("parseSchedule", () => {
	const html = loadFixture("schedule.html");
	const schedule = parseSchedule(html);

	it("extracts week number and year", () => {
		expect(schedule.weekNumber).toBe(50);
		expect(schedule.year).toBe(2025);
	});

	it("extracts modules", () => {
		expect(schedule.modules.length).toBeGreaterThanOrEqual(1);
		expect(schedule.modules[0].name).toContain("modul");
		expect(schedule.modules[0].timeRange).toMatch(/\d+:\d+\s*-\s*\d+:\d+/);
	});

	it("extracts days", () => {
		expect(schedule.days.length).toBeGreaterThanOrEqual(1);
		const monday = schedule.days.find((d) => d.dayName === "Mandag");
		expect(monday).toBeDefined();
		expect(monday?.date).toBe("2025-12-08");
		expect(monday?.isWeekend).toBe(false);
	});

	it("parses lesson items from Monday", () => {
		const monday = schedule.days.find((d) => d.dayName === "Mandag");
		expect(monday).toBeDefined();
		expect(monday?.items.length).toBeGreaterThanOrEqual(1);

		const tyLesson = monday?.items.find((item) => item.subject?.name.includes("1g Ty 4"));
		expect(tyLesson).toBeDefined();
		expect(tyLesson?.teacher?.initials).toBe("MH");
		expect(tyLesson?.room?.name).toBe("26");
		expect(tyLesson?.startTime).toBe("10:05");
		expect(tyLesson?.endTime).toBe("11:45");
		expect(tyLesson?.status).toBe("normal");
		expect(tyLesson?.activityId).toBe("ABS73519297289");
	});

	it("detects changed lessons", () => {
		const monday = schedule.days.find((d) => d.dayName === "Mandag");
		const changedLesson = monday?.items.find((item) => item.status === "changed");
		expect(changedLesson).toBeDefined();
		expect(changedLesson?.subject?.name).toContain("1x MA");
	});

	it("parses homework from tooltip", () => {
		const monday = schedule.days.find((d) => d.dayName === "Mandag");
		const tyLesson = monday?.items.find((item) => item.subject?.name.includes("1g Ty 4"));
		expect(tyLesson?.homework).toBeDefined();
		expect(tyLesson?.homework?.length).toBeGreaterThanOrEqual(1);
	});

	it("throws ParseError when schedule table is missing", () => {
		expect(() => parseSchedule("<html><body>No table here</body></html>")).toThrow(
			"Schedule table not found",
		);
	});
});
