const LECTIO_BASE = "https://www.lectio.dk";

export function buildLectioUrl(schoolId: number, path: string): string {
	const normalized = path.startsWith("/") ? path.slice(1) : path;
	return `${LECTIO_BASE}/lectio/${schoolId}/${normalized}`;
}

export function extractQueryParams(url: string): Record<string, string> {
	const parsed = new URL(url, LECTIO_BASE);
	const params: Record<string, string> = {};
	for (const [key, value] of parsed.searchParams) {
		params[key] = value;
	}
	return params;
}

export function isLoginPage(url: string): boolean {
	return url.includes("login.aspx");
}

export { LECTIO_BASE };
