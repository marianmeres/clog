/** Standard log levels mapping (based on syslog/RFC 5424) */
export const LEVEL_MAP = {
	debug: "DEBUG",
	log: "INFO",
	warn: "WARNING",
	error: "ERROR",
} as const;

/** Log level type */
export type LogLevel = keyof typeof LEVEL_MAP;

/** Normalized log data passed to writers and hooks */
export type LogData = {
	level: (typeof LEVEL_MAP)[LogLevel];
	namespace: string | false;
	args: any[];
	timestamp: string;
};

/** Writer function - receives normalized log data */
export type WriterFn = (data: LogData) => void;

/** Hook function - same signature as writer, for collecting/batching */
export type HookFn = WriterFn;

/** Logger interface - compatible with console API */
export interface Logger {
	debug: (...args: any[]) => string;
	log: (...args: any[]) => string;
	warn: (...args: any[]) => string;
	error: (...args: any[]) => string;
}

/** Clog interface - callable Logger with namespace */
export interface Clog extends Logger {
	(...args: any[]): string; // callable, proxies to log
	ns: string | false;
}

/** Instance-level configuration */
export interface ClogConfig {
	writer?: WriterFn;
	color?: string | null;
}

/** Global configuration */
export interface GlobalConfig {
	hook?: HookFn;
	writer?: WriterFn;
	jsonOutput?: boolean;
}

/** Detects current runtime environment */
function _detectRuntime(): "browser" | "node" | "deno" | "unknown" {
	if (typeof window !== "undefined" && (window as any)?.document) {
		return "browser";
	}
	if (globalThis.Deno?.version?.deno) return "deno";
	if ((globalThis as any).process?.versions?.node) return "node";
	return "unknown";
}

/** Global configuration state */
const GLOBAL: GlobalConfig = {
	hook: undefined,
	writer: undefined,
	jsonOutput: false,
};

/** Default writer implementation - handles browser vs server output */
const defaultWriter: WriterFn = (data: LogData) => {
	const { level, namespace, args, timestamp } = data;
	const runtime = _detectRuntime();

	// Map level back to console method (DEBUG->debug, INFO->log, etc)
	const consoleMethod = (
		{
			DEBUG: "debug",
			INFO: "log",
			WARNING: "warn",
			ERROR: "error",
		} as const
	)[level];

	if (runtime === "browser") {
		// Browser: simple output, let browser console do its magic
		const ns = namespace ? `[${namespace}]` : "";
		console[consoleMethod](ns, ...args);
	} else {
		// Server: structured output
		if (GLOBAL.jsonOutput) {
			const output: Record<string, any> = {
				timestamp,
				level,
				namespace,
				message: args[0],
			};

			// Include additional args as arg_0, arg_1, etc
			args.slice(1).forEach((arg, i) => {
				// Preserve Error stacks
				output[`arg_${i}`] = arg?.stack ?? arg;
			});

			console[consoleMethod](JSON.stringify(output));
		} else {
			// Text output: [timestamp] [LEVEL] [namespace] message ...args
			const ns = namespace ? `[${namespace}]` : "";
			const prefix = `[${timestamp}] [${level}] ${ns}`.trim();
			console[consoleMethod](prefix, ...args);
		}
	}
};

/** Default writer with color support (browser only) */
const colorWriter =
	(color: string): WriterFn =>
	(data: LogData) => {
		const { level, namespace, args } = data;
		const runtime = _detectRuntime();

		// Only apply color in browser
		if (runtime !== "browser" || !namespace) {
			return defaultWriter(data);
		}

		const consoleMethod = (
			{
				DEBUG: "debug",
				INFO: "log",
				WARNING: "warn",
				ERROR: "error",
			} as const
		)[level];

		const ns = `[${namespace}]`;
		console[consoleMethod](`%c${ns}`, `color:${color}`, ...args);
	};

/**
 * Creates a logger instance with optional namespace.
 *
 * @param namespace - Logger namespace (or false for no namespace)
 * @param config - Optional instance configuration
 * @returns Logger instance
 */
export function createClog(
	namespace?: string | false,
	config?: ClogConfig
): Clog {
	// Default to no namespace if not provided
	const ns = namespace ?? false;

	const _apply = (level: LogLevel, args: any[]): string => {
		const message = String(args[0] ?? "");

		const data: LogData = {
			level: LEVEL_MAP[level],
			namespace: ns,
			args,
			timestamp: new Date().toISOString(),
		};

		// Call hook first (if exists) - for collecting/batching
		GLOBAL.hook?.(data);

		// Then call writer (global override, or instance, or default)
		let writer = GLOBAL.writer ?? config?.writer;

		// If no custom writer but color is set, use color writer
		if (!writer && config?.color) {
			writer = colorWriter(config.color);
		}

		// Fall back to default writer
		writer = writer ?? defaultWriter;

		writer(data);

		return message;
	};

	// Create callable function that proxies to log
	const logger = ((...args: any[]) => _apply("log", args)) as Clog;

	// Attach methods
	logger.debug = (...args: any[]) => _apply("debug", args);
	logger.log = (...args: any[]) => _apply("log", args);
	logger.warn = (...args: any[]) => _apply("warn", args);
	logger.error = (...args: any[]) => _apply("error", args);

	// Attach ns as readonly
	Object.defineProperty(logger, "ns", { value: ns, writable: false });

	return logger;
}

/** Global configuration access */
createClog.global = GLOBAL;

/** Resets global configuration to defaults (useful for testing) */
createClog.reset = (): void => {
	createClog.global.hook = undefined;
	createClog.global.writer = undefined;
	createClog.global.jsonOutput = false;
};
