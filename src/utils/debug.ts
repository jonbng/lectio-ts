export interface Logger {
	log(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

export function createLogger(enabled: boolean): Logger {
	if (!enabled) {
		const noop = () => {};
		return { log: noop, warn: noop, error: noop };
	}

	const prefix = "[lectio-ts]";
	return {
		log: (message, ...args) => console.log(`${prefix} ${message}`, ...args),
		warn: (message, ...args) => console.warn(`${prefix} ${message}`, ...args),
		error: (message, ...args) => console.error(`${prefix} ${message}`, ...args),
	};
}
