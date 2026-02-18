export class LectioError extends Error {
	readonly url?: string;
	readonly statusCode?: number;

	constructor(message: string, options?: { url?: string; statusCode?: number; cause?: unknown }) {
		super(message, { cause: options?.cause });
		this.name = "LectioError";
		this.url = options?.url;
		this.statusCode = options?.statusCode;
	}
}

export class AuthenticationError extends LectioError {
	constructor(message: string, options?: { url?: string; statusCode?: number; cause?: unknown }) {
		super(message, options);
		this.name = "AuthenticationError";
	}
}

export class SessionExpiredError extends LectioError {
	constructor(message: string, options?: { url?: string; cause?: unknown }) {
		super(message, options);
		this.name = "SessionExpiredError";
	}
}

export class NetworkError extends LectioError {
	constructor(message: string, options?: { url?: string; statusCode?: number; cause?: unknown }) {
		super(message, options);
		this.name = "NetworkError";
	}
}

export class ParseError extends LectioError {
	readonly selector?: string;

	constructor(message: string, options?: { url?: string; selector?: string; cause?: unknown }) {
		super(message, { url: options?.url, cause: options?.cause });
		this.name = "ParseError";
		this.selector = options?.selector;
	}
}
