import {
	BatchFlusher,
	type BatchFlusherConfig,
	type BatchFlusherState,
} from "@marianmeres/batch";
import type { LogData } from "./clog.ts";

/** No-op logger to prevent circular dependency when used with createClog.global.hook */
const noopLogger = { debug: () => {}, log: () => {}, warn: () => {}, error: () => {} };

/**
 * Function signature for the log flusher that sends batched logs.
 * Should return `true` on success, `false` on failure.
 */
export type LogFlusherFn = (logs: LogData[]) => Promise<boolean>;

/**
 * Configuration options for the log forwarder.
 * Same as BatchFlusherConfig - see @marianmeres/batch docs for details.
 */
export type LogForwarderConfig = Partial<BatchFlusherConfig>;

/**
 * Log forwarder interface - wraps BatchFlusher for clog hook usage.
 */
export interface LogForwarder {
	/** Hook function to assign to createClog.global.hook */
	hook: (data: LogData) => void;
	/** Add log entry to batch (alias for hook) */
	add: (data: LogData) => void;
	/** Flush current buffer immediately */
	flush: () => Promise<boolean>;
	/** Flush remaining items and stop */
	drain: () => Promise<boolean>;
	/** Start auto-flush interval */
	start: () => void;
	/** Stop auto-flush interval */
	stop: () => void;
	/** Clear buffer and state */
	reset: () => void;
	/** Get current buffer contents */
	dump: () => LogData[];
	/** Update configuration */
	configure: (config: LogForwarderConfig) => void;
	/** Subscribe to state changes */
	subscribe: (fn: (state: BatchFlusherState) => void) => () => void;
	/** Current buffer size */
	readonly size: number;
	/** Whether interval flushing is active */
	readonly isRunning: boolean;
	/** Whether flush operation is in progress */
	readonly isFlushing: boolean;
}

/**
 * Creates a log forwarder that batches log entries and sends them using the provided flusher.
 *
 * Wraps `@marianmeres/batch` BatchFlusher for convenient integration with clog's hook system.
 *
 * @param flusher - Async function that receives batched logs and returns success status
 * @param config - Optional BatchFlusher configuration
 * @param autostart - Whether to start interval flushing immediately (default: true)
 * @returns LogForwarder instance
 *
 * @example
 * ```typescript
 * import { createClog } from "@marianmeres/clog";
 * import { createLogForwarder } from "@marianmeres/clog/forward";
 *
 * const forwarder = createLogForwarder(
 *   async (logs) => {
 *     await fetch("/api/logs", { method: "POST", body: JSON.stringify(logs) });
 *     return true;
 *   },
 *   { flushIntervalMs: 5000, flushThreshold: 50, maxBatchSize: 1000 }
 * );
 *
 * createClog.global.hook = forwarder.hook;
 *
 * // On shutdown
 * process.on("SIGTERM", async () => {
 *   await forwarder.drain();
 *   process.exit(0);
 * });
 * ```
 */
export function createLogForwarder(
	flusher: LogFlusherFn,
	config?: LogForwarderConfig,
	autostart?: boolean
): LogForwarder {
	// Default to noopLogger to prevent circular dependency when used with createClog.global.hook
	// (BatchFlusher uses clog internally for debug output)
	const mergedConfig = { logger: noopLogger, ...config };
	const batcher = new BatchFlusher<LogData>(flusher, mergedConfig, autostart);

	return {
		hook: (data: LogData) => batcher.add(data),
		add: (data: LogData) => batcher.add(data),
		flush: () => batcher.flush(),
		drain: () => batcher.drain(),
		start: () => batcher.start(),
		stop: () => batcher.stop(),
		reset: () => batcher.reset(),
		dump: () => batcher.dump(),
		configure: (cfg) => batcher.configure(cfg),
		subscribe: (fn) => batcher.subscribe(fn),
		get size() {
			return batcher.size;
		},
		get isRunning() {
			return batcher.isRunning;
		},
		get isFlushing() {
			return batcher.isFlushing;
		},
	};
}
