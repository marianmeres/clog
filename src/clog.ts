import { autoColor, CLOG_STYLED } from "./colors.ts";

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
 * Sentinel returned by a hook to signal that the writer should be skipped
 * for the current log call. All other logs continue normally.
 *
 * @example
 * ```typescript
 * import { createClog, CLOG_SKIP } from "@marianmeres/clog";
 * createClog.global.hook = (data) => {
 *   if (shouldDrop(data)) return CLOG_SKIP;
 * };
 * ```
 */
export const CLOG_SKIP: unique symbol = Symbol.for("@marianmeres/clog-skip");

/**
 * Conceptual identifiers for the top-level fields emitted in JSON output mode.
 * Used as keys in {@link JsonFieldNames} to remap the actual emitted property
 * name. `arg` is special — it is used as a prefix for sequenced extra args
 * (`arg_0`, `arg_1`, …), so renaming it to e.g. `"extra"` produces
 * `extra_0`, `extra_1`, …
 */
export type JsonFieldKey =
	| "timestamp"
	| "level"
	| "logger"
	| "message"
	| "meta"
	| "arg"
	| "stack";

/**
 * Per-field rename map for JSON output. Any key omitted falls back to the
 * default name. Resolution is per-key: instance config > global config >
 * default.
 *
 * @example
 * ```typescript
 * // Restore the pre-3.18 default for the namespace field:
 * createClog.global.jsonFieldNames = { logger: "namespace" };
 *
 * // Datadog-friendly subset:
 * createClog.global.jsonFieldNames = {
 *   timestamp: "@timestamp",
 *   level: "status",
 *   logger: "logger.name",
 * };
 * ```
 */
export type JsonFieldNames = Partial<Record<JsonFieldKey, string>>;

/**
 * Default JSON field names. The `logger` slot replaces the pre-3.18
 * `"namespace"` field name.
 */
const DEFAULT_JSON_FIELD_NAMES: Required<JsonFieldNames> = {
	timestamp: "timestamp",
	level: "level",
	logger: "logger",
	message: "message",
	meta: "meta",
	arg: "arg",
	stack: "stack",
};

/**
 * Internal marker placed on Clog instances so `withNamespace` can detect them
 * and compose a structured child namespace instead of prefixing an arg.
 */
const CLOG_INSTANCE: unique symbol = Symbol.for("@marianmeres/clog-instance");

/**
 * Normalized log data structure passed to writers and hooks.
 *
 * @property level - RFC 5424 level name: `"DEBUG"` | `"INFO"` | `"WARNING"` | `"ERROR"`
 * @property namespace - The logger namespace, or `false` if no namespace. Composed
 *                       namespaces (from `withNamespace`) use `:` as separator,
 *                       e.g. `"app:module:sub"`.
 * @property args - Shallow clone of the arguments passed to the log method. Safe
 *                  to read; mutating does not affect the caller's array.
 * @property timestamp - ISO 8601 formatted timestamp string
 * @property config - Instance-level configuration (optional, for per-instance settings)
 * @property meta - Metadata from `getMeta()`, lazily computed. Accessing the
 *                  property invokes `getMeta` once and caches the result. If
 *                  `getMeta` throws, this property is `undefined` (the error
 *                  is swallowed so logging never fails because of metadata).
 * @property stack - Captured call stack lines (already filtered to user frames),
 *                   present only when `stacktrace` is enabled. Default writers
 *                   render this; custom writers can use it as they wish.
 */
export type LogData = {
	level: (typeof LEVEL_MAP)[LogLevel];
	namespace: string | false;
	// deno-lint-ignore no-explicit-any
	args: any[];
	timestamp: string;
	config?: ClogConfig;
	meta?: Record<string, unknown>;
	stack?: string[];
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
 * Hooks are called before writers. Return {@link CLOG_SKIP} to suppress the
 * writer for the current log call (all other logs continue normally). Any
 * other return value is ignored.
 *
 * @param data - Normalized log data being logged
 * @returns `CLOG_SKIP` to skip the writer, anything else to continue.
 *
 * @example
 * ```typescript
 * const batch: LogData[] = [];
 * createClog.global.hook = (data) => batch.push(data);
 * ```
 */
export type HookFn = (data: LogData) => void | typeof CLOG_SKIP;

/**
 * Logger interface compatible with the console API.
 * All methods return the first argument as a string for convenience patterns.
 *
 * Note: Return type is `any` to ensure true compatibility with `console`.
 * Console methods return `void`, but clog returns the first argument as string.
 * Using `any` allows both `console` and clog to satisfy this interface.
 */
export interface Logger {
	/**
	 * Logs a debug message (DEBUG level).
	 * @param args - Arguments to log
	 * @returns The first argument as a string (clog) or void (console)
	 */
	// deno-lint-ignore no-explicit-any
	debug: (...args: any[]) => any;

	/**
	 * Logs an info message (INFO level).
	 * @param args - Arguments to log
	 * @returns The first argument as a string (clog) or void (console)
	 */
	// deno-lint-ignore no-explicit-any
	log: (...args: any[]) => any;

	/**
	 * Logs a warning message (WARNING level).
	 * @param args - Arguments to log
	 * @returns The first argument as a string (clog) or void (console)
	 */
	// deno-lint-ignore no-explicit-any
	warn: (...args: any[]) => any;

	/**
	 * Logs an error message (ERROR level).
	 * @param args - Arguments to log
	 * @returns The first argument as a string (clog) or void (console)
	 */
	// deno-lint-ignore no-explicit-any
	error: (...args: any[]) => any;
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
	// deno-lint-ignore no-explicit-any
	(...args: any[]): any;

	/**
	 * The namespace of this logger instance.
	 * Readonly property set at creation time. Composed namespaces (from
	 * `withNamespace`) use `:` as separator, e.g. `"app:module"`.
	 */
	readonly ns: string | false;
}

/**
 * Instance-level configuration options for a Clog logger.
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
	// `string & {}` preserves "auto" literal in IntelliSense while allowing any string
	// deno-lint-ignore ban-types
	color?: "auto" | (string & {}) | null;

	/**
	 * When `false`, `.debug()` calls become no-ops (output is suppressed).
	 * All other log levels (`.log()`, `.warn()`, `.error()`) work normally.
	 * @default true (debug output enabled)
	 */
	debug?: boolean;

	/**
	 * When `true`, JSON.stringify non-primitive arguments.
	 * Makes all logged values visible as plain strings.
	 * @default false
	 */
	stringify?: boolean;

	/**
	 * When `true`, concatenate all arguments into a single string. Implies
	 * stringify (objects are JSON-stringified regardless of the `stringify`
	 * setting, so combining `concat: true` with `stringify: false` still
	 * stringifies).
	 * @default false
	 */
	concat?: boolean;

	/**
	 * When enabled, capture and append a call stack. `true` = full stack,
	 * `number` = limit to N frames. The captured frames are also exposed to
	 * custom writers via `LogData.stack`.
	 * @default undefined (disabled)
	 */
	stacktrace?: boolean | number;

	/**
	 * When `true`, emit structured JSON instead of text in server runtimes
	 * (Node/Deno). Browser output is unaffected. Falls back to
	 * `GlobalConfig.jsonOutput` if unset.
	 * @default undefined (inherits global)
	 */
	jsonOutput?: boolean;

	/**
	 * Per-field rename map for JSON output. Any omitted key falls back to the
	 * default name (per-key resolution: instance > global > default). Useful
	 * for matching the field names expected by your log aggregator.
	 *
	 * Default names: `timestamp`, `level`, `logger`, `message`, `meta`, `arg`
	 * (used as prefix for `arg_0`, `arg_1`, …), `stack`.
	 *
	 * @example
	 * ```typescript
	 * // Restore the pre-3.18 "namespace" field name:
	 * const clog = createClog("api", { jsonFieldNames: { logger: "namespace" } });
	 * ```
	 */
	jsonFieldNames?: JsonFieldNames;

	/**
	 * Function called lazily on each log to return metadata. Metadata is
	 * available in `LogData.meta` for custom writers/hooks. If this function
	 * throws, the error is swallowed and meta stays `undefined` — logging
	 * never fails because of metadata.
	 * @example
	 * ```typescript
	 * const clog = createClog("app", {
	 *   getMeta: () => ({ userId: getCurrentUserId(), requestId: getRequestId() })
	 * });
	 * ```
	 */
	getMeta?: () => Record<string, unknown>;
}

/**
 * Global configuration options affecting all Clog logger instances.
 */
export interface GlobalConfig {
	/** Global hook function called before every log operation. */
	hook?: HookFn;

	/** Global writer that overrides all instance-level writers. */
	writer?: WriterFn;

	/** Enable structured JSON output for server environments. */
	jsonOutput?: boolean;

	/**
	 * Per-field rename map for JSON output (can be overridden per-instance via
	 * `ClogConfig.jsonFieldNames`). Resolution is per-key: instance > global >
	 * default. See {@link JsonFieldNames}.
	 */
	jsonFieldNames?: JsonFieldNames;

	/** Global debug mode. When `false`, `.debug()` calls become no-ops. */
	debug?: boolean;

	/** Global stringify mode. */
	stringify?: boolean;

	/** Global concat mode. Implies stringify. */
	concat?: boolean;

	/** Global stacktrace mode. `true` = full stack, `number` = limit to N frames. */
	stacktrace?: boolean | number;

	/**
	 * Global getMeta function. Called lazily per log; errors are swallowed.
	 */
	getMeta?: () => Record<string, unknown>;
}

/**
 * Global configuration state.
 * Uses Symbol.for + globalThis to ensure truly global state across multiple
 * module instances (e.g., when different packages bundle their own copy).
 */
const GLOBAL_KEY = Symbol.for("@marianmeres/clog");
// deno-lint-ignore no-explicit-any
const GLOBAL: GlobalConfig = ((globalThis as any)[GLOBAL_KEY] ??= {
	hook: undefined,
	writer: undefined,
	jsonOutput: false,
	debug: undefined,
});

// --- Runtime detection (cached) ---

type Runtime = "browser" | "node" | "deno" | "unknown";

let _cachedRuntime: Runtime | null = null;
function detectRuntime(): Runtime {
	if (_cachedRuntime !== null) return _cachedRuntime;
	// deno-lint-ignore no-explicit-any
	if (typeof window !== "undefined" && (window as any)?.document) {
		return (_cachedRuntime = "browser");
	}
	if (globalThis.Deno?.version?.deno) return (_cachedRuntime = "deno");
	// deno-lint-ignore no-explicit-any
	if ((globalThis as any).process?.versions?.node) {
		return (_cachedRuntime = "node");
	}
	return (_cachedRuntime = "unknown");
}

// --- Stack capture (path-based frame filtering) ---

/**
 * Identifier substring used to detect clog's own stack frames. Works for both
 * filesystem paths and URLs. `colors.ts` is included because styled helpers may
 * also appear in the trace.
 */
const CLOG_FRAME_MARKERS = ["clog.ts", "colors.ts"];

function isClogFrame(line: string): boolean {
	return CLOG_FRAME_MARKERS.some((m) => line.includes(m));
}

/**
 * Captures a call stack and strips internal clog frames by matching file
 * paths. Result is the frames belonging to the caller of the log method.
 */
function captureStackLines(limit?: number): string[] {
	const stack = new Error().stack || "";
	const lines = stack.split("\n");
	// First line in V8 is "Error" (or "Error: ..."); drop any "Error" header
	// and any frame that references clog's own files.
	const relevant: string[] = [];
	for (const raw of lines) {
		const line = raw.trimEnd();
		if (!line) continue;
		if (/^Error(:|$)/.test(line.trim())) continue;
		if (isClogFrame(line)) continue;
		relevant.push(line);
	}
	if (typeof limit === "number" && limit > 0) {
		return relevant.slice(0, limit);
	}
	return relevant;
}

/**
 * Formats an array of stack frame lines into a single human-readable block
 * suitable for appending to console output. Exported so custom writers can
 * produce the same rendering as the default writer.
 */
export function formatStack(lines: string[]): string {
	return "\n---\nStack:\n" + lines.map((v) => "  " + v.trim()).join("\n");
}

// --- Namespace rendering ---

/**
 * Renders a (possibly composed) namespace into the bracketed text form.
 * `"app:module"` → `"[app] [module]"`. Keeps text-output BC for users of
 * `withNamespace`, which now composes via `:` internally.
 */
function renderNs(ns: string | false): string {
	if (!ns) return "";
	return ns
		.split(":")
		.map((s) => `[${s}]`)
		.join(" ");
}

// --- Arg processing ---

/** Stringify non-primitive args when stringify flag is enabled */
// deno-lint-ignore no-explicit-any
function _stringifyArgs(args: any[], config?: ClogConfig): any[] {
	if (!(config?.stringify ?? GLOBAL.stringify)) return args;
	return args.map((arg) => {
		if (arg === null || arg === undefined) return arg;
		if (typeof arg !== "object") return arg;
		// Handle StyledText - extract plain text
		if (arg?.[CLOG_STYLED]) return arg.text;
		// Stringify objects/arrays
		try {
			return JSON.stringify(arg);
		} catch {
			return String(arg);
		}
	});
}

/**
 * Stringify a single value for logging output.
 * Handles null, undefined, primitives, StyledText, and objects.
 * Useful for custom writers that need to convert values to strings.
 */
// deno-lint-ignore no-explicit-any
export function stringifyValue(arg: any): string {
	if (arg === null) return "null";
	if (arg === undefined) return "undefined";
	if (typeof arg !== "object") return String(arg);
	if (arg?.[CLOG_STYLED]) return arg.text;
	try {
		return JSON.stringify(arg);
	} catch {
		return String(arg);
	}
}

/** Check if any arg is a styled text object */
// deno-lint-ignore no-explicit-any
function _hasStyledArgs(args: any[]): boolean {
	return args.some((arg) => arg?.[CLOG_STYLED]);
}

/** Clean styled args by extracting plain text (for non-%c environments) */
// deno-lint-ignore no-explicit-any
function _cleanStyledArgs(args: any[]): any[] {
	return args.map((arg) => (arg?.[CLOG_STYLED] ? arg.text : arg));
}

/** Process args containing styled text objects, building %c format string */
// deno-lint-ignore no-explicit-any
function _processStyledArgs(args: any[]): [string, any[]] {
	let format = "";
	// deno-lint-ignore no-explicit-any
	const values: any[] = [];

	for (const arg of args) {
		if (arg?.[CLOG_STYLED]) {
			format += `%c${arg.text}%c `;
			values.push(arg.style, "");
		} else if (typeof arg === "string") {
			format += `${arg} `;
		} else {
			format += "%o ";
			values.push(arg);
		}
	}

	return [format.trim(), values];
}

/**
 * Computes the "display string" for args[0] — what the caller should get back
 * from `clog.log()`. Under stringify or concat modes, objects are JSON
 * rendered to match what actually appears in the log line.
 */
// deno-lint-ignore no-explicit-any
function firstArgAsString(args: any[], config?: ClogConfig): string {
	if (args.length === 0) return "";
	const concat = config?.concat ?? GLOBAL.concat;
	const stringify = config?.stringify ?? GLOBAL.stringify;
	if (concat || stringify) return stringifyValue(args[0]);
	return String(args[0] ?? "");
}

// --- Console method mapping ---

const CONSOLE_METHOD = {
	DEBUG: "debug",
	INFO: "log",
	WARNING: "warn",
	ERROR: "error",
} as const;

// --- Default writers ---

/** Default writer implementation - handles browser vs server output */
const defaultWriter: WriterFn = (data: LogData) => {
	const { level, namespace, args, timestamp, config, stack } = data;
	const runtime = detectRuntime();
	const consoleMethod = CONSOLE_METHOD[level];
	const nsText = renderNs(namespace);
	const stackStr = stack && stack.length ? formatStack(stack) : null;

	// Concat mode: single string, plain text (no %c)
	const shouldConcat = config?.concat ?? GLOBAL.concat;
	if (shouldConcat) {
		const stringified = args.map(stringifyValue).join(" ");
		const output =
			runtime === "browser"
				? nsText
					? `${nsText} ${stringified}`
					: stringified
				: `[${timestamp}] [${level}]${nsText ? ` ${nsText}` : ""} ${stringified}`;
		console[consoleMethod](output, ...(stackStr ? [stackStr] : []));
		return;
	}

	// Apply stringify transformation (if enabled)
	const processedArgs = _stringifyArgs(args, config);
	const hasStyled = _hasStyledArgs(processedArgs);

	// Browser/Deno with styled args: use %c formatting
	if ((runtime === "browser" || runtime === "deno") && hasStyled) {
		const [content, contentValues] = _processStyledArgs(processedArgs);
		if (runtime === "browser") {
			console[consoleMethod](
				nsText ? `${nsText} ${content}` : content,
				...contentValues,
				...(stackStr ? [stackStr] : [])
			);
		} else {
			const prefix = `[${timestamp}] [${level}]${nsText ? ` ${nsText}` : ""}`;
			console[consoleMethod](
				`${prefix} ${content}`,
				...contentValues,
				...(stackStr ? [stackStr] : [])
			);
		}
		return;
	}

	// Clean styled args (extract plain text) for non-%c paths
	const cleanedArgs = _cleanStyledArgs(processedArgs);

	if (runtime === "browser") {
		if (nsText) {
			console[consoleMethod](
				nsText,
				...cleanedArgs,
				...(stackStr ? [stackStr] : [])
			);
		} else {
			console[consoleMethod](
				...cleanedArgs,
				...(stackStr ? [stackStr] : [])
			);
		}
		return;
	}

	// Server (Node / Deno / unknown) output path
	const useJson = config?.jsonOutput ?? GLOBAL.jsonOutput;
	if (useJson) {
		// Per-key resolution: instance > global > default. Spread merges only
		// the keys the user supplied, so a partial map keeps unrelated names.
		const fieldNames = {
			...DEFAULT_JSON_FIELD_NAMES,
			...GLOBAL.jsonFieldNames,
			...config?.jsonFieldNames,
		};
		// deno-lint-ignore no-explicit-any
		const output: Record<string, any> = {
			[fieldNames.timestamp]: timestamp,
			[fieldNames.level]: level,
			...(namespace ? { [fieldNames.logger]: namespace } : {}),
			[fieldNames.message]: cleanedArgs[0],
			...(data.meta && { [fieldNames.meta]: data.meta }),
		};
		cleanedArgs.slice(1).forEach((arg, i) => {
			output[`${fieldNames.arg}_${i}`] = arg?.stack ?? arg;
		});
		if (stackStr) output[fieldNames.stack] = stackStr;
		console[consoleMethod](JSON.stringify(output));
		return;
	}

	// Text: [timestamp] [LEVEL] [namespace] message ...args
	const prefix = `[${timestamp}] [${level}]${nsText ? ` ${nsText}` : ""}`.trim();
	console[consoleMethod](
		prefix,
		...cleanedArgs,
		...(stackStr ? [stackStr] : [])
	);
};

/** Default writer with color support (browser and deno) */
const colorWriter =
	(configuredColor: string): WriterFn =>
	(data: LogData) => {
		const { level, namespace, args, timestamp, config, stack } = data;
		const runtime = detectRuntime();

		// %c coloring only applies to browser/deno with an actual namespace;
		// concat mode emits plain text and also delegates.
		if (
			(runtime !== "browser" && runtime !== "deno") ||
			!namespace ||
			(config?.concat ?? GLOBAL.concat)
		) {
			return defaultWriter(data);
		}

		const color =
			configuredColor === "auto" ? autoColor(namespace) : configuredColor;
		const processedArgs = _stringifyArgs(args, config);
		const consoleMethod = CONSOLE_METHOD[level];
		const stackStr = stack && stack.length ? formatStack(stack) : null;
		const nsText = renderNs(namespace);

		if (_hasStyledArgs(processedArgs)) {
			const [content, contentValues] = _processStyledArgs(processedArgs);
			if (runtime === "browser") {
				console[consoleMethod](
					`%c${nsText}%c ${content}`,
					`color:${color}`,
					"",
					...contentValues,
					...(stackStr ? [stackStr] : [])
				);
			} else {
				const prefix = `[${timestamp}] [${level}] %c${nsText}%c`;
				console[consoleMethod](
					`${prefix} ${content}`,
					`color:${color}`,
					"",
					...contentValues,
					...(stackStr ? [stackStr] : [])
				);
			}
			return;
		}

		if (runtime === "browser") {
			console[consoleMethod](
				`%c${nsText}`,
				`color:${color}`,
				...processedArgs,
				...(stackStr ? [stackStr] : [])
			);
		} else {
			const prefix = `[${timestamp}] [${level}] %c${nsText}`;
			console[consoleMethod](
				prefix,
				`color:${color}`,
				...processedArgs,
				...(stackStr ? [stackStr] : [])
			);
		}
	};

// --- Factory ---

/**
 * Creates a Clog logger instance with optional namespace and configuration.
 *
 * The returned logger is callable (proxies to `log()`) and provides
 * console-compatible methods: `debug()`, `log()`, `warn()`, `error()`.
 * All methods return the first argument as a string — under `stringify`/`concat`
 * modes, objects are JSON-rendered in the return value so that the logged line
 * and the returned string match.
 *
 * @param namespace - Logger namespace string, or `false` for no namespace.
 *                    Defaults to `false` if not provided.
 * @param config - Optional instance-level configuration
 * @returns A callable {@link Clog} logger instance
 *
 * @example
 * ```typescript
 * const clog = createClog("my-app");
 * clog.log("Hello");           // [my-app] Hello
 * clog("Hello");               // Same as above (callable)
 *
 * const logger = createClog();
 * logger.warn("Warning!");     // Warning!
 *
 * const colored = createClog("ui", { color: "blue" });
 *
 * throw new Error(clog.error("Failed"));
 * ```
 */
export function createClog(
	namespace?: string | false,
	config?: ClogConfig
): Clog {
	const ns = namespace ?? false;

	// deno-lint-ignore no-explicit-any
	const _apply = (level: LogLevel, args: any[]): string => {
		// Shallow clone args so hooks/writers cannot mutate the caller's array.
		const clonedArgs = args.slice();

		// Resolve getMeta lazily so it's only called if a consumer reads .meta,
		// and wrap in try/catch so throwing getMeta never crashes a log call.
		const getMetaFn = config?.getMeta ?? GLOBAL.getMeta;

		// Stacktrace: capture *once* in _apply (fewer internal frames to filter)
		// so custom writers can also access data.stack.
		const stacktraceConfig = config?.stacktrace ?? GLOBAL.stacktrace;
		const stack = stacktraceConfig
			? captureStackLines(
					typeof stacktraceConfig === "number" ? stacktraceConfig : undefined
				)
			: undefined;

		const data: LogData = {
			level: LEVEL_MAP[level],
			namespace: ns,
			args: clonedArgs,
			timestamp: new Date().toISOString(),
			config,
			stack,
		};

		if (getMetaFn) {
			let _meta: Record<string, unknown> | undefined;
			let _metaComputed = false;
			Object.defineProperty(data, "meta", {
				get() {
					if (!_metaComputed) {
						_metaComputed = true;
						try {
							_meta = getMetaFn();
						} catch {
							// Swallow — a throwing getMeta must not break logging.
							_meta = undefined;
						}
					}
					return _meta;
				},
				enumerable: true,
				configurable: true,
			});
		}

		// Hook first (can return CLOG_SKIP to suppress writer).
		const hookResult = GLOBAL.hook?.(data);

		if (hookResult !== CLOG_SKIP) {
			let writer = GLOBAL.writer ?? config?.writer;
			if (!writer && config?.color) writer = colorWriter(config.color);
			writer = writer ?? defaultWriter;
			writer(data);
		}

		return firstArgAsString(clonedArgs, config);
	};

	// Create callable function that proxies to log
	// deno-lint-ignore no-explicit-any
	const logger = ((...args: any[]) => _apply("log", args)) as Clog;

	// deno-lint-ignore no-explicit-any
	logger.debug = (...args: any[]) => {
		if ((config?.debug ?? GLOBAL.debug) === false) {
			return firstArgAsString(args, config);
		}
		return _apply("debug", args);
	};
	// deno-lint-ignore no-explicit-any
	logger.log = (...args: any[]) => _apply("log", args);
	// deno-lint-ignore no-explicit-any
	logger.warn = (...args: any[]) => _apply("warn", args);
	// deno-lint-ignore no-explicit-any
	logger.error = (...args: any[]) => _apply("error", args);

	Object.defineProperty(logger, "ns", { value: ns, writable: false });

	// Non-enumerable marker so `withNamespace` can detect clog instances and
	// compose structurally. Carries the original config for inheritance.
	Object.defineProperty(logger, CLOG_INSTANCE, {
		value: { ns, config },
		enumerable: false,
		writable: false,
	});

	return logger;
}

/**
 * Global configuration object for all Clog instances.
 *
 * Properties:
 * - `hook` - Function called before every log (return `CLOG_SKIP` to drop)
 * - `writer` - Global writer that overrides all instance writers
 * - `jsonOutput` - Enable JSON output format for server environments
 * - `jsonFieldNames` - Per-field rename map for JSON output
 * - `debug` - Global debug mode (can be overridden per-instance)
 *
 * @example
 * ```typescript
 * createClog.global.jsonOutput = true;
 *
 * const batch: LogData[] = [];
 * createClog.global.hook = (data) => batch.push(data);
 *
 * createClog.global.writer = (data) => sendToServer(data);
 *
 * createClog.global.debug = false;
 * ```
 */
createClog.global = GLOBAL;

/**
 * Resets global configuration to default values.
 * Clears all fields and sets `jsonOutput` to `false`. Useful for testing.
 */
createClog.reset = (): void => {
	createClog.global.hook = undefined;
	createClog.global.writer = undefined;
	createClog.global.jsonOutput = false;
	createClog.global.jsonFieldNames = undefined;
	createClog.global.debug = undefined;
	createClog.global.stringify = undefined;
	createClog.global.concat = undefined;
	createClog.global.stacktrace = undefined;
	createClog.global.getMeta = undefined;
};

/**
 * Creates a no-op logger that satisfies the Clog interface but doesn't output.
 * Useful for testing scenarios where console output is not desired.
 * All methods return the first argument as a string (same as regular clog).
 *
 * @param namespace - Optional namespace (accessible via `.ns`). Accepts
 *                    `string | false | null` for legacy compatibility; any
 *                    falsy value disables the namespace.
 */
export function createNoopClog(namespace?: string | false | null): Clog {
	// deno-lint-ignore no-explicit-any
	const _return = (...args: any[]) => String(args[0] ?? "");
	const clog = _return as Clog;
	clog.debug = _return;
	clog.log = _return;
	clog.warn = _return;
	clog.error = _return;
	Object.defineProperty(clog, "ns", {
		value: namespace || false,
		writable: false,
	});
	return clog;
}

/**
 * Wraps a logger with an additional namespace. Two behaviors:
 *
 * 1. **Clog instance**: returns a *new* clog whose namespace is composed with
 *    the parent (separator `:`), e.g. `withNamespace(createClog("app"), "module")`
 *    has `ns === "app:module"`. This preserves `LogData.namespace` for
 *    structured output (JSON mode) and propagates the parent's config.
 * 2. **Non-clog logger** (e.g. native `console`): returns a wrapper that
 *    prepends `[namespace]` as the first argument on each call (same as
 *    before). This is the only path that can work without clog internals.
 *
 * In either case, text output renders `"app:module"` as `[app] [module]` via
 * the shared namespace renderer, so visible formatting is unchanged.
 *
 * @param logger - Any console-compatible logger (clog, console, or custom)
 * @param namespace - Namespace string to prepend / compose
 * @returns A wrapped logger. If the input is a clog instance, a fresh Clog is
 *          returned (with readonly `.ns` composed). Otherwise, a wrapper with
 *          the input's interface plus a callable signature.
 *
 * @example
 * ```typescript
 * const clog = createClog("app");
 * const moduleLogger = withNamespace(clog, "module");
 * moduleLogger.log("hello");   // [app] [module] hello
 * moduleLogger.ns;             // "app:module"
 *
 * const logger = withNamespace(console, "my-module");
 * logger.warn("warning");      // [my-module] warning
 * ```
 */
export function withNamespace<T extends Logger>(
	logger: T,
	namespace: string
	// deno-lint-ignore no-explicit-any
): T & ((...args: any[]) => string) {
	// deno-lint-ignore no-explicit-any
	const marker = (logger as any)[CLOG_INSTANCE] as
		| { ns: string | false; config?: ClogConfig }
		| undefined;

	if (marker) {
		// Compose structurally: new clog with composed namespace + inherited config
		const composed = marker.ns ? `${marker.ns}:${namespace}` : namespace;
		// deno-lint-ignore no-explicit-any
		return createClog(composed, marker.config) as any;
	}

	// Non-clog logger: preserve arg-prefix wrapping (for native console etc.)
	const prefix = `[${namespace}]`;

	// deno-lint-ignore no-explicit-any
	const wrapped = ((...args: any[]) => {
		logger.log(prefix, ...args);
		return String(args[0] ?? "");
		// deno-lint-ignore no-explicit-any
	}) as T & ((...args: any[]) => string);

	// deno-lint-ignore no-explicit-any
	wrapped.debug = (...args: any[]) => {
		logger.debug(prefix, ...args);
		return String(args[0] ?? "");
	};
	// deno-lint-ignore no-explicit-any
	wrapped.log = (...args: any[]) => {
		logger.log(prefix, ...args);
		return String(args[0] ?? "");
	};
	// deno-lint-ignore no-explicit-any
	wrapped.warn = (...args: any[]) => {
		logger.warn(prefix, ...args);
		return String(args[0] ?? "");
	};
	// deno-lint-ignore no-explicit-any
	wrapped.error = (...args: any[]) => {
		logger.error(prefix, ...args);
		return String(args[0] ?? "");
	};

	return wrapped;
}
