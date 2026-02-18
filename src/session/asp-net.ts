import { loadHtml } from "../utils/html.js";

const ASP_NET_FIELD_NAMES = [
	"__VIEWSTATEX",
	"__VIEWSTATE",
	"__VIEWSTATEY_KEY",
	"__EVENTVALIDATION",
	"__EVENTARGUMENT",
	"__SCROLLPOSITION",
	"masterfootervalue",
] as const;

export interface AspNetFields {
	[key: string]: string;
}

export function extractAspNetFields(html: string): AspNetFields {
	const $ = loadHtml(html);
	const fields: AspNetFields = {};

	for (const name of ASP_NET_FIELD_NAMES) {
		const el = $(`input[name="${name}"]`);
		if (el.length > 0) {
			fields[name] = (el.val() as string) ?? "";
		}
	}

	const timeEl = $('input[name="time"]');
	if (timeEl.length > 0) {
		fields.time = (timeEl.val() as string) ?? "0";
	}

	return fields;
}

export function buildPostbackData(
	fields: AspNetFields,
	eventTarget: string,
	extra?: Record<string, string>,
): Record<string, string> {
	return {
		...fields,
		__EVENTTARGET: eventTarget,
		...extra,
	};
}
