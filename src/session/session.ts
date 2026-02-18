import fetchCookie from "fetch-cookie";
import { Cookie, CookieJar } from "tough-cookie";
import { fetch as undiciFetch } from "undici";
import { NetworkError, SessionExpiredError } from "../errors/index.js";
import { type Logger, createLogger } from "../utils/debug.js";
import { buildLectioUrl, isLoginPage } from "../utils/url.js";

interface FetchInit {
	method: string;
	headers?: Record<string, string>;
	body?: string;
}

type FetchFn = (url: string, init?: FetchInit) => Promise<Response>;

const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const DEFAULT_HEADERS: Record<string, string> = {
	"user-agent": USER_AGENT,
	accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"accept-language": "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7",
	"upgrade-insecure-requests": "1",
	"sec-fetch-site": "same-origin",
	"sec-fetch-mode": "navigate",
	"sec-fetch-dest": "document",
	connection: "keep-alive",
	dnt: "1",
};

const LECTIO_DOMAIN = "https://www.lectio.dk";

export interface SessionResponse {
	html: string;
	url: string;
	status: number;
}

export interface SessionOptions {
	schoolId: number;
	autologinKey: string;
	debug?: boolean;
	/** Override the fetch implementation (useful for testing). */
	fetch?: FetchFn;
}

export class Session {
	readonly schoolId: number;
	private readonly autologinKey: string;
	private readonly jar: CookieJar;
	private readonly fetchImpl: FetchFn;
	private readonly log: Logger;
	private authenticated = false;

	constructor(options: SessionOptions) {
		this.schoolId = options.schoolId;
		this.autologinKey = options.autologinKey;
		this.log = createLogger(options.debug ?? false);

		this.jar = new CookieJar();

		if (options.fetch) {
			// Wrap the provided fetch with cookie jar management
			this.fetchImpl = fetchCookie(options.fetch as never, this.jar) as unknown as FetchFn;
		} else {
			this.fetchImpl = fetchCookie(undiciFetch as never, this.jar) as unknown as FetchFn;
		}

		this.seedAutologinCookies();
	}

	get isAuthenticated(): boolean {
		return this.authenticated;
	}

	markAuthenticated(): void {
		this.authenticated = true;
	}

	buildUrl(path: string, params?: Record<string, string>): string {
		const base = buildLectioUrl(this.schoolId, path);
		if (!params || Object.keys(params).length === 0) return base;

		const url = new URL(base);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
		return url.toString();
	}

	async get(path: string, params?: Record<string, string>): Promise<SessionResponse> {
		const url = this.buildUrl(path, params);
		return this.request(url, { method: "GET" });
	}

	async post(path: string, body: Record<string, string>): Promise<SessionResponse> {
		const url = this.buildUrl(path);
		const encoded = new URLSearchParams(body).toString();
		return this.request(url, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: encoded,
		});
	}

	private async request(url: string, init: FetchInit, isRetry = false): Promise<SessionResponse> {
		this.log.log(`${init.method} ${url}`);

		let response: Response;
		try {
			response = await this.fetchImpl(url, {
				...init,
				headers: { ...DEFAULT_HEADERS, ...init.headers },
			});
		} catch (err) {
			throw new NetworkError(`Request failed: ${url}`, { url, cause: err });
		}

		const finalUrl = response.url || url;
		const html = await response.text();

		this.log.log(`Response ${response.status} from ${finalUrl} (${html.length} chars)`);

		if (!response.ok && !isLoginPage(finalUrl)) {
			throw new NetworkError(`HTTP ${response.status}: ${finalUrl}`, {
				url: finalUrl,
				statusCode: response.status,
			});
		}

		if (this.isSessionExpired(finalUrl, html)) {
			if (isRetry) {
				throw new SessionExpiredError("Session expired and auto-refresh failed", { url: finalUrl });
			}

			this.log.warn("Session expired, attempting auto-refresh...");
			await this.refreshSession();
			return this.request(url, init, true);
		}

		return { html, url: finalUrl, status: response.status };
	}

	private isSessionExpired(url: string, html: string): boolean {
		if (isLoginPage(url)) return true;

		// Check if the HTML contains the auth meta tag - if so, we're authenticated
		if (html.includes("msapplication-starturl")) return false;

		// Check for login-page indicators in the early portion of the document
		const LOGIN_INDICATOR = /unilogin|log\s*ind/i;
		if (LOGIN_INDICATOR.test(html.slice(0, 5000))) {
			return true;
		}

		return false;
	}

	private async refreshSession(): Promise<void> {
		this.log.log("Refreshing session: clearing stale cookies and re-seeding autologin key");
		this.authenticated = false;

		await this.removeSessionCookies();
		this.seedAutologinCookies();
	}

	private seedAutologinCookies(): void {
		const now = new Date();
		const farFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

		const autologinCookie = new Cookie({
			key: "autologinkeyV2",
			value: this.autologinKey,
			domain: "www.lectio.dk",
			path: "/",
			expires: farFuture,
			httpOnly: false,
			secure: false,
		});

		const loggedInCookie = new Cookie({
			key: "isloggedin3",
			value: "Y",
			domain: "www.lectio.dk",
			path: "/",
			expires: farFuture,
			httpOnly: false,
			secure: false,
		});

		this.jar.setCookieSync(autologinCookie.toString(), LECTIO_DOMAIN);
		this.jar.setCookieSync(loggedInCookie.toString(), LECTIO_DOMAIN);

		this.log.log("Seeded autologinkeyV2 and isloggedin3 cookies");
	}

	private async removeSessionCookies(): Promise<void> {
		const cookies = await this.jar.getCookies(LECTIO_DOMAIN);
		for (const cookie of cookies) {
			if (cookie.key === "ASP.NET_SessionId") {
				await this.jar.store.removeCookie(
					cookie.domain ?? "www.lectio.dk",
					cookie.path ?? "/",
					cookie.key,
				);
				this.log.log("Removed stale ASP.NET_SessionId cookie");
			}
		}
	}
}
