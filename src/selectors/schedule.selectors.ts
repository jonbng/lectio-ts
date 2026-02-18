export const SCHEDULE_SELECTORS = {
	table: ".s2skema",
	dayHeaderRow: "tr.s2dayHeader",
	dayHeaderCell: "tr.s2dayHeader td",

	lessonBlock: "a.s2skemabrik",
	lessonBlockWithLink: "a.s2skemabrik.s2brik",

	moduleBackground: ".s2module-bg",
	moduleInfo: ".s2module-info",

	weekHeader: ".s2weekHeader",
	datePicker: 'input[id$="datePicker_tb"]',

	lessonContent: ".s2skemabrikcontent",
	lessonIcons: ".s2skemabrikIcons",
	lessonTimeValue: ".separator-value",
	lessonTitleValue: ".separator-undervalue",
} as const;

export const SCHEDULE_STATUS_CLASSES = {
	normal: "s2normal",
	changed: "s2changed",
	cancelled: "s2cancelled",
} as const;

export const SCHEDULE_DATA_ATTRS = {
	brikId: "data-brikid",
	tooltip: "data-tooltip",
	date: "data-date",
	module: "data-module",
} as const;

export const SCHEDULE_PATTERNS = {
	weekInfo: /Uge (\d+) - (\d+)/,
	dayHeader: /(\w+)\s*\((\d+)\/(\d+)\)/,
	tooltipTime: /(\d+\/\d+-\d+)\s+(\d+:\d+)\s+til\s+(\d+:\d+)/,
	tooltipHold: /^Hold:\s*(.+)$/m,
	tooltipTeacher: /^Lærer:\s*(.+?)\s*\((.+?)\)$/m,
	tooltipRoom: /^Lokale:\s*(.+)$/m,
	tooltipHomework: /Lektier:([\s\S]*?)(?=Note:|$)/,
	tooltipNote: /Note:\s*([\s\S]*?)$/,
} as const;
