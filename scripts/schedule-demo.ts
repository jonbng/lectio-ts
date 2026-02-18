#!/usr/bin/env bun
/**
 * Demo script: fetches this week's schedule from Lectio and prints it to the console.
 *
 * Usage:
 *   LECTIO_SCHOOL_ID=94 LECTIO_AUTOLOGIN_KEY=your-key bun run scripts/schedule-demo.ts
 *
 * Or with debug logging:
 *   LECTIO_SCHOOL_ID=94 LECTIO_AUTOLOGIN_KEY=your-key DEBUG=1 bun run scripts/schedule-demo.ts
 */

import { LectioClient } from "../src/client/lectio-client.js";
import type { ScheduleDay, ScheduleLesson, WeekSchedule } from "../src/schemas/schedule.js";

function getCurrentWeekParam(): string {
	const now = new Date();
	const d = new Date(
		Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
	);
	const dayNum = d.getUTCDay() || 7; // Monday = 1, Sunday = 7
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	const year = d.getUTCFullYear();
	return `${String(weekNo).padStart(2, "0")}${year}`;
}

function formatLesson(lesson: ScheduleLesson, indent: string): string {
	const time =
		lesson.startTime && lesson.endTime
			? `${lesson.startTime}–${lesson.endTime}`
			: "—";
	const subject = lesson.subject?.name ?? lesson.title ?? "?";
	const room = lesson.room?.name ?? "—";
	const teacher = lesson.teacher ? ` (${lesson.teacher.initials})` : "";
	const status =
		lesson.status === "cancelled"
			? " [AFLYST]"
			: lesson.status === "changed"
				? " [ÆNDRET]"
				: "";

	return `${indent}  ${time}  ${subject}  ·  ${room}${teacher}${status}`;
}

function formatDay(day: ScheduleDay): string {
	const lines: string[] = [];
	lines.push(`\n  ${day.dayName} ${day.date}${day.isWeekend ? " (weekend)" : ""}`);
	lines.push("  " + "—".repeat(50));

	if (day.items.length === 0) {
		lines.push("  (ingen timer)");
	} else {
		for (const item of day.items) {
			lines.push(formatLesson(item, "  "));
		}
	}

	return lines.join("\n");
}

function printSchedule(schedule: WeekSchedule): void {
	console.log("\n┌─────────────────────────────────────────────────────────────┐");
	console.log(`│  Uge ${schedule.weekNumber} · ${schedule.year}  ·  Skema`);
	console.log("└─────────────────────────────────────────────────────────────┘");

	for (const day of schedule.days) {
		console.log(formatDay(day));
	}

	console.log("\n");
}

async function main(): Promise<void> {
	const schoolIdRaw = process.env.LECTIO_SCHOOL_ID;
	const autologinKey = process.env.LECTIO_AUTOLOGIN_KEY;

	if (!schoolIdRaw || !autologinKey) {
		console.error("Missing credentials. Set environment variables:");
		console.error("  LECTIO_SCHOOL_ID    (e.g. 94)");
		console.error("  LECTIO_AUTOLOGIN_KEY (value of the autologinkeyV2 cookie from Lectio)");
		console.error("\nExample:");
		console.error(
			"  LECTIO_SCHOOL_ID=94 LECTIO_AUTOLOGIN_KEY=your-key bun run scripts/schedule-demo.ts",
		);
		process.exit(1);
	}

	const schoolId = Number.parseInt(schoolIdRaw, 10);
	if (Number.isNaN(schoolId)) {
		console.error("LECTIO_SCHOOL_ID must be a number.");
		process.exit(1);
	}

	const debug = Boolean(process.env.DEBUG);
	const client = new LectioClient({ schoolId, autologinKey, debug });

	try {
		console.log("Connecting to Lectio...");
		const info = await client.connect();
		console.log(`Connected as ${info.isTeacher ? "teacher" : "student"} (${info.studentId})\n`);

		const weekParam = getCurrentWeekParam();
		console.log(`Fetching schedule for week ${weekParam}...`);
		const schedule = await client.getSchedule({ week: weekParam });

		printSchedule(schedule);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const name = err instanceof Error ? err.name : "Error";
		console.error(`\n${name}: ${message}`);
		if (err instanceof Error && err.cause) {
			console.error("Cause:", err.cause);
		}
		process.exit(1);
	}
}

main();
