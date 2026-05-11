/**
 * @module
 * Web preset for `@marianmeres/clog`.
 *
 * Bundles the boilerplate every web-app frontend repeats: batched log
 * forwarding wired into `createClog.global.hook`, global error /
 * unhandled-rejection capture, `getMeta` installation, and a persistent
 * agent-ID helper.
 *
 * The HTTP layer is intentionally not owned here — consumers pass a
 * `send(entries)` callback that encodes their own backend contract
 * (URL, headers, body shape, auth). This keeps the preset format-agnostic.
 *
 * Runtime enable/disable is the consumer's concern: call `forwarder.stop()`
 * / `forwarder.start()` on the returned handle, or gate inside the `send`
 * callback.
 *
 * @example
 * ```typescript
 * import {
 *   configureWebLogger,
 *   getOrCreateAgentId,
 * } from "@marianmeres/clog/web";
 *
 * const agentId = getOrCreateAgentId({ storageKey: "my-app-agent-id" });
 *
 * const forwarder = configureWebLogger({
 *   send: async (logs) => {
 *     await fetch("/api/logs", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ entries: logs }),
 *       keepalive: true,
 *     });
 *   },
 *   flushIntervalMs: 2000,
 *   getMeta: () => ({ agentId, userId: getCurrentUserId() }),
 * });
 *
 * // Pause forwarding (logs still hit the console):
 * forwarder?.stop();
 * ```
 */
import { createClog, type LogData } from "./clog.ts";
import { createLogForwarder, type LogForwarder } from "./forward.ts";

/**
 * Default localStorage key used by {@linkcode getOrCreateAgentId}.
 */
export const DEFAULT_AGENT_ID_STORAGE_KEY = "clog-agent-id";

/**
 * Configuration for {@linkcode configureWebLogger}.
 */
export interface ConfigureWebLoggerOptions {
	/**
	 * Async function that ships a batch of log entries. Receives the
	 * `LogData[]` accumulated by the underlying batcher. Throwing or
	 * rejecting marks the flush as failed (BatchFlusher will retry per
	 * its own config).
	 *
	 * Omit to run in console-only mode (no forwarder is created, but
	 * `getMeta` and error handlers still install).
	 */
	send?: (logs: LogData[]) => Promise<void> | void;
	/** BatchFlusher interval in ms. Passed through to `createLogForwarder`. */
	flushIntervalMs?: number;
	/** BatchFlusher max batch size. Passed through to `createLogForwarder`. */
	maxBatchSize?: number;
	/**
	 * Installed as `createClog.global.getMeta`. Called lazily per log
	 * (clog only invokes it if a consumer reads `data.meta`, and any
	 * thrown error is swallowed). Always installed when provided, even
	 * in console-only mode.
	 */
	getMeta?: () => Record<string, unknown>;
	/**
	 * Filter for uncaught errors. Return `false` to drop the event
	 * before logging (useful for third-party noise). Any other return
	 * value — including `undefined` — lets the error through.
	 */
	uncaughtErrorFilter?: (e: ErrorEvent) => void | false;
	/**
	 * Filter for unhandled promise rejections. Return `false` to drop
	 * the event before logging.
	 */
	unhandledRejectionFilter?: (e: PromiseRejectionEvent) => void | false;
	/**
	 * `true` (default) registers the built-in handler, `false` disables
	 * it, a function uses your custom handler instead.
	 */
	onUncaughtError?: boolean | ((e: ErrorEvent) => void);
	/**
	 * `true` (default) registers the built-in handler, `false` disables
	 * it, a function uses your custom handler instead.
	 */
	onUnhandledRejection?: boolean | ((e: PromiseRejectionEvent) => void);
}

/**
 * Wires `@marianmeres/clog` for a typical web-app setup: batched log
 * forwarding, browser error capture, and `getMeta` installation.
 *
 * Returns the underlying {@linkcode LogForwarder} when `send` is
 * provided so consumers can `drain()` on shutdown, `stop()` / `start()`
 * to toggle forwarding, or `subscribe()` to its state. Returns
 * `undefined` in console-only mode (no `send`) or in environments
 * without `addEventListener`.
 *
 * @example
 * ```typescript
 * const forwarder = configureWebLogger({
 *   send: async (logs) => {
 *     await fetch("/api/logs", {
 *       method: "POST",
 *       body: JSON.stringify({ entries: logs }),
 *     });
 *   },
 * });
 *
 * globalThis.addEventListener("beforeunload", () => {
 *   forwarder?.drain();
 * });
 * ```
 */
export function configureWebLogger(
	opts: ConfigureWebLoggerOptions = {},
): LogForwarder | undefined {
	const {
		send,
		flushIntervalMs,
		maxBatchSize,
		getMeta,
		uncaughtErrorFilter,
		unhandledRejectionFilter,
		onUncaughtError = true,
		onUnhandledRejection = true,
	} = opts;

	let forwarder: LogForwarder | undefined;

	if (send) {
		forwarder = createLogForwarder(
			async (logs: LogData[]) => {
				try {
					await send(logs);
					return true;
				} catch {
					// Returning false signals BatchFlusher to retry.
					return false;
				}
			},
			{ flushIntervalMs, maxBatchSize },
		);

		createClog.global.hook = forwarder.hook;
	}

	if (getMeta) {
		createClog.global.getMeta = getMeta;
	}

	// Error handlers require a DOM-style global. Skip in node and other
	// non-browser runtimes.
	if (typeof globalThis?.addEventListener !== "function") {
		return forwarder;
	}

	const errorHandler =
		onUncaughtError === true
			? makeDefaultUncaughtErrorHandler(uncaughtErrorFilter)
			: onUncaughtError === false
				? undefined
				: onUncaughtError;

	const rejectionHandler =
		onUnhandledRejection === true
			? makeDefaultUnhandledRejectionHandler(unhandledRejectionFilter)
			: onUnhandledRejection === false
				? undefined
				: onUnhandledRejection;

	if (errorHandler) {
		globalThis.addEventListener("error", errorHandler);
	}
	if (rejectionHandler) {
		globalThis.addEventListener("unhandledrejection", rejectionHandler);
	}

	return forwarder;
}

/**
 * Gets or creates a persistent client identifier stored in
 * `localStorage`. Useful for correlating logs from a specific browser
 * tab/profile across sessions.
 *
 * Returns `"n/a"` outside a browser (no `localStorage`). If reading or
 * writing `localStorage` fails (private mode, quota, disabled storage),
 * a fresh in-memory id is returned and the failure is logged to
 * `console.error`.
 *
 * @example
 * ```typescript
 * const agentId = getOrCreateAgentId({ storageKey: "my-app-agent-id" });
 * configureWebLogger({ getMeta: () => ({ agentId }) });
 * ```
 */
export function getOrCreateAgentId(
	opts: { storageKey?: string } = {},
): string {
	const { storageKey = DEFAULT_AGENT_ID_STORAGE_KEY } = opts;

	if (!isBrowser()) return "n/a";

	let id: string | null = null;
	try {
		id = globalThis.localStorage?.getItem(storageKey) ?? null;
	} catch (e) {
		console.error(`Unable to read agent id from localStorage. Details: ${e}`);
	}

	if (!id) {
		id = Math.random().toString(36).slice(2);
		try {
			globalThis.localStorage?.setItem(storageKey, id);
		} catch (e) {
			console.error(`Unable to persist agent id to localStorage. Details: ${e}`);
		}
	}

	return id;
}

function makeDefaultUncaughtErrorHandler(
	filter?: (e: ErrorEvent) => void | false,
) {
	const clog = createClog("uncaught_error");
	return (e: ErrorEvent) => {
		if (filter?.(e) === false) return;
		clog.error(e.message, {
			filename: e.filename,
			lineno: e.lineno,
			colno: e.colno,
			error: e.error,
		});
	};
}

function makeDefaultUnhandledRejectionHandler(
	filter?: (e: PromiseRejectionEvent) => void | false,
) {
	const clog = createClog("unhandled_rejection");
	return (e: PromiseRejectionEvent) => {
		if (filter?.(e) === false) return;
		clog.error("Unhandled Promise Rejection", {
			stack: e.reason?.stack,
			reason: e.reason,
		});
	};
}

function isBrowser(): boolean {
	return (
		typeof window !== "undefined" &&
		"document" in globalThis &&
		globalThis === window
	);
}
