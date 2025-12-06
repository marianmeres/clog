/**
 * Standard log levels mapping based on syslog/RFC 5424.
 *
 * Maps console-style method names to RFC 5424 severity level names:
 * - `debug` → `"DEBUG"`
 * - `log` → `"INFO"`
 * - `warn` → `"WARNING"`
 * - `error` → `"ERROR"`
 *
 * @example
 * ```typescript
 * import { LEVEL_MAP } from "@marianmeres/clog";
 * console.log(LEVEL_MAP.debug); // "DEBUG"
 * console.log(LEVEL_MAP.log);   // "INFO"
 * ```
 */
export const LEVEL_MAP = {
	debug: "DEBUG",
	log: "INFO",
	warn: "WARNING",
	error: "ERROR",
} as const;

/**
 * Log level type representing the available console-style log methods.
 * One of: `"debug"` | `"log"` | `"warn"` | `"error"`
 */
export type LogLevel = keyof typeof LEVEL_MAP;

/**
 * Normalized log data structure passed to writers and hooks.
 *
 * @property level - RFC 5424 level name: `"DEBUG"` | `"INFO"` | `"WARNING"` | `"ERROR"`
 * @property namespace - The logger namespace, or `false` if no namespace
 * @property args - Array of all arguments passed to the log method
 * @property timestamp - ISO 8601 formatted timestamp string
 */
export type LogData = {
	level: (typeof LEVEL_MAP)[LogLevel];
	namespace: string | false;
	args: any[];
	timestamp: string;
};

/**
 * Writer function signature for custom log output handlers.
 * Receives normalized {@link LogData} and handles the actual output.
 *
 * @param data - Normalized log data to be written
 *
 * @example
 * ```typescript
 * const myWriter: WriterFn = (data) => {
 *   console.log(`[${data.level}] ${data.args.join(" ")}`);
 * };
 * ```
 */
export type WriterFn = (data: LogData) => void;

/**
 * Hook function signature for intercepting log calls.
 * Same signature as {@link WriterFn}, used for collecting, batching, or analytics.
 * Hooks are called before writers.
 *
 * @param data - Normalized log data being logged
 *
 * @example
 * ```typescript
 * const batch: LogData[] = [];
 * createClog.global.hook = (data) => batch.push(data);
 * ```
 */
export type HookFn = WriterFn;

/**
 * Logger interface compatible with the console API.
 * All methods return the first argument as a string for convenience patterns.
 */
export interface Logger {
	/**
	 * Logs a debug message (DEBUG level).
	 * @param args - Arguments to log
	 * @returns The first argument as a string
	 */
	debug: (...args: any[]) => string;

	/**
	 * Logs an info message (INFO level).
	 * @param args - Arguments to log
	 * @returns The first argument as a string
	 */
	log: (...args: any[]) => string;

	/**
	 * Logs a warning message (WARNING level).
	 * @param args - Arguments to log
	 * @returns The first argument as a string
	 */
	warn: (...args: any[]) => string;

	/**
	 * Logs an error message (ERROR level).
	 * @param args - Arguments to log
	 * @returns The first argument as a string
	 */
	error: (...args: any[]) => string;
}

/**
 * Clog interface - a callable Logger with namespace support.
 * Can be invoked directly as a function (proxies to `log()`) or via methods.
 *
 * @example
 * ```typescript
 * const clog = createClog("app");
 * clog("message");       // Same as clog.log("message")
 * clog.debug("debug");
 * clog.ns;               // "app" (readonly)
 * ```
 */
export interface Clog extends Logger {
	/**
	 * Callable signature - proxies to `log()` method.
	 * @param args - Arguments to log
	 * @returns The first argument as a string
	 */
	(...args: any[]): string;

	/**
	 * The namespace of this logger instance.
	 * Readonly property set at creation time.
	 */
	readonly ns: string | false;
}

/**
 * Instance-level configuration options for a Clog logger.
 *
 * @property writer - Custom writer function for this instance only
 * @property color - CSS color string for namespace styling (browser/Deno only)
 */
export interface ClogConfig {
	/**
	 * Custom writer function for this logger instance.
	 * Overridden by global writer if set.
	 */
	writer?: WriterFn;

	/**
	 * CSS color string for namespace styling.
	 * Only works in browser and Deno environments (uses `%c` formatting).
	 * @example "red", "blue", "#ff0000"
	 */
	color?: string | null;
}

/**
 * Global configuration options affecting all Clog logger instances.
 *
 * @property hook - Hook function called before every log (for batching/analytics)
 * @property writer - Global writer that overrides all instance writers
 * @property jsonOutput - Enable JSON output format for server environments
 */
export interface GlobalConfig {
	/**
	 * Global hook function called before every log operation.
	 * Useful for batching, analytics, or collecting logs.
	 */
	hook?: HookFn;

	/**
	 * Global writer that overrides all instance-level writers.
	 * Takes highest precedence in writer selection.
	 */
	writer?: WriterFn;

	/**
	 * Enable structured JSON output for server environments.
	 * When true, outputs single-line JSON objects instead of text.
	 * @default false
	 */
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

/**
 * Global configuration state.
 * Uses Symbol.for + globalThis to ensure truly global state across multiple
 * module instances (e.g., when different packages bundle their own copy).
 */
const GLOBAL_KEY = Symbol.for("@marianmeres/clog");
const GLOBAL: GlobalConfig = ((globalThis as any)[GLOBAL_KEY] ??= {
	hook: undefined,
	writer: undefined,
	jsonOutput: false,
});

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

/** Default writer with color support (browser and deno) */
const colorWriter =
	(color: string): WriterFn =>
	(data: LogData) => {
		const { level, namespace, args, timestamp } = data;
		const runtime = _detectRuntime();

		// Only apply %c color in browser and deno
		if ((runtime !== "browser" && runtime !== "deno") || !namespace) {
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

		if (runtime === "browser") {
			console[consoleMethod](`%c${ns}`, `color:${color}`, ...args);
		} else {
			// Deno: include timestamp and level like server mode, %c must be in first arg
			const prefix = `[${timestamp}] [${level}] %c${ns}`;
			console[consoleMethod](prefix, `color:${color}`, ...args);
		}
	};

/**
 * Creates a Clog logger instance with optional namespace and configuration.
 *
 * The returned logger is callable (proxies to `log()`) and provides
 * console-compatible methods: `debug()`, `log()`, `warn()`, `error()`.
 * All methods return the first argument as a string, enabling patterns like
 * `throw new Error(clog.error("message"))`.
 *
 * @param namespace - Logger namespace string, or `false` for no namespace.
 *                    Defaults to `false` if not provided.
 * @param config - Optional instance-level configuration
 * @returns A callable {@link Clog} logger instance
 *
 * @example
 * ```typescript
 * // Basic usage with namespace
 * const clog = createClog("my-app");
 * clog.log("Hello");           // [my-app] Hello
 * clog("Hello");               // Same as above (callable)
 *
 * // Without namespace
 * const logger = createClog();
 * logger.warn("Warning!");     // Warning!
 *
 * // With color (browser/Deno only)
 * const colored = createClog("ui", { color: "blue" });
 *
 * // Error throwing pattern
 * throw new Error(clog.error("Failed"));
 * ```
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

/**
 * Global configuration object for all Clog instances.
 *
 * Properties:
 * - `hook` - Function called before every log (for batching/analytics)
 * - `writer` - Global writer that overrides all instance writers
 * - `jsonOutput` - Enable JSON output format for server environments
 *
 * @example
 * ```typescript
 * // Enable JSON output
 * createClog.global.jsonOutput = true;
 *
 * // Set up log batching
 * const batch: LogData[] = [];
 * createClog.global.hook = (data) => batch.push(data);
 *
 * // Custom global writer
 * createClog.global.writer = (data) => sendToServer(data);
 * ```
 */
createClog.global = GLOBAL;

/**
 * Resets global configuration to default values.
 * Clears `hook`, `writer`, and sets `jsonOutput` to `false`.
 * Useful for testing to ensure clean state between tests.
 *
 * @example
 * ```typescript
 * // In test teardown
 * createClog.reset();
 * ```
 */
createClog.reset = (): void => {
	createClog.global.hook = undefined;
	createClog.global.writer = undefined;
	createClog.global.jsonOutput = false;
};
