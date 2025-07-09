/**
 * `createLogger` supported methods.
 *
 * Note: return type is intentionally `any`, so the consumer can always use `console` as
 * a valid Logger (the `createLogger` returns the message (first arg) `string` for convenience).
 */
export interface Logger {
	debug: (...args: any[]) => any;
	log: (...args: any[]) => any;
	warn: (...args: any[]) => any;
	error: (...args: any[]) => any;
}

/**
 * Creates a conventional log data logger wrap around console-log. Is less fancy than createClog,
 * but more suitable for server side logging.
 */
export function createLogger(service: string, jsonOutput = false): Logger {
	const CONSOLE_TO_LEVEL = {
		debug: "DEBUG",
		log: "INFO",
		warn: "WARNING",
		error: "ERROR",
	};

	function _create(
		level: "debug" | "log" | "warn" | "error",
		...args: any[]
	) {
		const message = args[0];
		const rest = args.slice(1);
		const timestamp = new Date().toISOString();

		if (jsonOutput) {
			console[level](
				JSON.stringify({
					timestamp,
					level: CONSOLE_TO_LEVEL[level],
					service,
					message,
					...rest.reduce(
						(m, a, i) => ({ ...m, [`arg_${i}`]: a.stack ?? a }),
						{}
					),
				})
			);
		} else {
			console[level](
				`[${timestamp}] [${CONSOLE_TO_LEVEL[level]}] [${service}] ${message}`,
				...rest
			);
		}

		return `${message}`;
	}

	return {
		debug: (...args: any[]) => _create("debug", ...args),
		log: (...args: any[]) => _create("log", ...args),
		warn: (...args: any[]) => _create("warn", ...args),
		error: (...args: any[]) => _create("error", ...args),
	};
}
