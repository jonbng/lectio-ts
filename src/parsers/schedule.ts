import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import { ParseError } from "../errors/index.js";
import type {
	LessonStatus,
	ModuleInfo,
	ScheduleDay,
	ScheduleLesson,
	WeekSchedule,
} from "../schemas/schedule.js";
import {
	SCHEDULE_DATA_ATTRS,
	SCHEDULE_PATTERNS,
	SCHEDULE_SELECTORS,
	SCHEDULE_STATUS_CLASSES,
} from "../selectors/schedule.selectors.js";
import { loadHtml } from "../utils/html.js";
import type { CheerioDocument } from "../utils/html.js";

export function parseSchedule(html: string): WeekSchedule {
	const $ = loadHtml(html);

	const table = $(SCHEDULE_SELECTORS.table);
	if (table.length === 0) {
		throw new ParseError("Schedule table not found", {
			selector: SCHEDULE_SELECTORS.table,
		});
	}

	const { weekNumber, year } = extractWeekInfo($);
	const modules = extractModules($);
	const days = extractDays($, year);

	return { weekNumber, year, days, modules };
}

function extractWeekInfo($: CheerioDocument): { weekNumber: number; year: number } {
	const weekHeaderText = $(SCHEDULE_SELECTORS.weekHeader).text();
	const match = weekHeaderText.match(SCHEDULE_PATTERNS.weekInfo);

	if (match) {
		return {
			weekNumber: Number.parseInt(match[1], 10),
			year: Number.parseInt(match[2], 10),
		};
	}

	return { weekNumber: 0, year: new Date().getFullYear() };
}

function extractModules($: CheerioDocument): ModuleInfo[] {
	const modules: ModuleInfo[] = [];

	$(SCHEDULE_SELECTORS.moduleInfo).each((_, el) => {
		// Replace <br> with newline before extracting text
		const clone = $(el).clone();
		clone.find("br").replaceWith("\n");
		const text = clone.text().trim();
		const lines = text
			.split(/\n/)
			.map((l) => l.trim())
			.filter(Boolean);

		if (lines.length >= 2) {
			const nameMatch = lines[0].match(/^(\d+)\.\s*modul$/);
			if (nameMatch) {
				modules.push({
					number: Number.parseInt(nameMatch[1], 10),
					name: lines[0],
					timeRange: lines[1],
				});
			}
		}
	});

	return modules;
}

function extractDays($: CheerioDocument, year: number): ScheduleDay[] {
	const days: ScheduleDay[] = [];

	const headerCells = $(SCHEDULE_SELECTORS.dayHeaderCell);
	const dayNames: { name: string; date: string; dayMonth: string }[] = [];

	headerCells.each((_, el) => {
		const text = $(el).text().trim();
		if (!text) return;

		const match = text.match(SCHEDULE_PATTERNS.dayHeader);
		if (match) {
			let dayName = match[1];
			const day = match[2];
			const month = match[3];

			if (dayName === "rdag") dayName = "Lørdag";
			if (dayName === "ndag") dayName = "Søndag";

			dayNames.push({
				name: dayName,
				date: `${day}/${month}`,
				dayMonth: `${day}/${month}-${year}`,
			});
		}
	});

	const dateCells = $("td[data-date]");
	const dateToDayIndex = new Map<string, number>();

	dateCells.each((_, el) => {
		const dateStr = $(el).attr("data-date");
		if (!dateStr) return;

		const [_y, m, d] = dateStr.split("-").map(Number);
		const dateKey = `${d}/${m}`;

		const idx = dayNames.findIndex((dn) => dn.date === dateKey);
		if (idx >= 0 && !dateToDayIndex.has(dateKey)) {
			dateToDayIndex.set(dateKey, idx);

			const items = parseLessonsInCell($, $(el), year);
			const isWeekend = dayNames[idx].name === "Lørdag" || dayNames[idx].name === "Søndag";

			days.push({
				date: dateStr,
				dayName: dayNames[idx].name,
				items,
				isWeekend,
			});
		}
	});

	// Also parse info-header events (whole-day events etc.)
	const infoRow = $("tr").has("td.s2infoHeader");
	if (infoRow.length > 0) {
		const infoCells = infoRow.find("td.s2infoHeader.s2skemabrikcontainer");
		infoCells.each((cellIdx, el) => {
			const cellLessons = parseLessonsInCell($, $(el), year);
			if (cellLessons.length === 0) return;

			for (const lesson of cellLessons) {
				const existingDay = days.find((d) => {
					if (!lesson.date) return false;
					return (
						d.date.endsWith(lesson.date.replace(/\//g, "-")) ||
						lesson.date.includes(d.date.split("-").reverse().join("/").slice(0, 5))
					);
				});

				if (existingDay) {
					existingDay.items.push(lesson);
				} else if (cellIdx < dayNames.length) {
					const dayInfo = dayNames[cellIdx];
					const existing = days.find((d) => d.dayName === dayInfo.name);
					if (existing) {
						existing.items.push(lesson);
					}
				}
			}
		});
	}

	return days;
}

function parseLessonsInCell(
	$: CheerioDocument,
	cell: Cheerio<AnyNode>,
	year: number,
): ScheduleLesson[] {
	const lessons: ScheduleLesson[] = [];

	cell.find(SCHEDULE_SELECTORS.lessonBlock).each((_, el) => {
		const lesson = parseLessonElement($, $(el), year);
		if (lesson) lessons.push(lesson);
	});

	return lessons;
}

function parseLessonElement(
	_$: CheerioDocument,
	el: Cheerio<AnyNode>,
	year: number,
): ScheduleLesson | null {
	const tooltip = el.attr(SCHEDULE_DATA_ATTRS.tooltip) ?? "";
	const brikId = el.attr(SCHEDULE_DATA_ATTRS.brikId);

	const status = determineLessonStatus(el);
	const parsed = parseTooltip(tooltip, year);

	if (!parsed) return null;

	return {
		activityId: brikId,
		status,
		...parsed,
	};
}

function determineLessonStatus(el: Cheerio<AnyNode>): LessonStatus {
	const classes = el.attr("class") ?? "";
	if (classes.includes(SCHEDULE_STATUS_CLASSES.cancelled)) return "cancelled";
	if (classes.includes(SCHEDULE_STATUS_CLASSES.changed)) return "changed";
	return "normal";
}

function parseTooltip(
	tooltip: string,
	_year: number,
): Omit<ScheduleLesson, "activityId" | "status"> | null {
	if (!tooltip.trim()) return null;

	const lines = tooltip
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	if (lines.length === 0) return null;

	let startTime: string | undefined;
	let endTime: string | undefined;
	let date = "";
	let subject: { name: string; code?: string } | undefined;
	let teacher: { name: string; initials: string } | undefined;
	let room: { name: string } | undefined;
	let topic: string | undefined;
	let notes: string | undefined;
	const homework: { description: string }[] = [];

	// First line might be a topic/title if it doesn't match structured patterns
	if (
		lines[0] &&
		!lines[0].includes("til") &&
		!lines[0].match(/^\d+\/\d+-/) &&
		!lines[0].startsWith("Hold:") &&
		!lines[0].startsWith("Lærer:") &&
		!lines[0].startsWith("Lokale:")
	) {
		topic = lines[0];
	}

	for (const line of lines) {
		const timeMatch = line.match(SCHEDULE_PATTERNS.tooltipTime);
		if (timeMatch) {
			date = timeMatch[1];
			startTime = timeMatch[2];
			endTime = timeMatch[3];
			continue;
		}

		if (line.includes("Hele dagen")) {
			const dateInLine = lines.find((l) => l.match(/\d+\/\d+-\d+/));
			if (dateInLine) {
				const dm = dateInLine.match(/(\d+\/\d+-\d+)/);
				if (dm) date = dm[1];
			}
			continue;
		}

		const holdMatch = line.match(SCHEDULE_PATTERNS.tooltipHold);
		if (holdMatch) {
			subject = { name: holdMatch[1].trim() };
			continue;
		}

		const teacherMatch = line.match(SCHEDULE_PATTERNS.tooltipTeacher);
		if (teacherMatch) {
			teacher = { name: teacherMatch[1].trim(), initials: teacherMatch[2].trim() };
			continue;
		}

		const roomMatch = line.match(SCHEDULE_PATTERNS.tooltipRoom);
		if (roomMatch) {
			room = { name: roomMatch[1].trim() };
		}
	}

	// Parse homework section
	const homeworkMatch = tooltip.match(SCHEDULE_PATTERNS.tooltipHomework);
	if (homeworkMatch) {
		const homeworkText = homeworkMatch[1];
		const homeworkLines = homeworkText.split("\n");
		for (const hline of homeworkLines) {
			const trimmed = hline.trim();
			if (trimmed.startsWith("-")) {
				homework.push({ description: trimmed.slice(1).trim() });
			}
		}
	}

	// Parse notes
	const noteMatch = tooltip.match(SCHEDULE_PATTERNS.tooltipNote);
	if (noteMatch) {
		notes = noteMatch[1].trim() || undefined;
	}

	if (!subject && topic) {
		subject = { name: topic };
	}

	return {
		subject,
		teacher,
		room,
		startTime,
		endTime,
		date,
		title: topic,
		topic,
		homework: homework.length > 0 ? homework : undefined,
		notes,
	};
}
