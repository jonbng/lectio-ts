import * as cheerio from "cheerio";

export type CheerioDocument = cheerio.CheerioAPI;

export function loadHtml(raw: string): CheerioDocument {
	return cheerio.load(raw);
}
