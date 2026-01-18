/**
 * Example: Axiom.co Log Forwarder
 *
 * This example demonstrates how to use `createLogForwarder` to batch and forward
 * logs to Axiom (https://axiom.co) - a log management and observability service.
 *
 * Prerequisites:
 * - An Axiom account with a dataset created
 * - An API token with ingest permissions
 *
 * Usage:
 *   AXIOM_TOKEN=your-token AXIOM_DATASET=your-dataset deno run --allow-net --allow-env examples/axiom-forwarder.ts
 */

import { createClog, type LogData } from "../src/mod.ts";
import { createLogForwarder } from "../src/forward.ts";

// -----------------------------------------------------------------------------
// Axiom Configuration
// -----------------------------------------------------------------------------

interface AxiomConfig {
	/** Your Axiom dataset name */
	dataset: string;
	/** Your Axiom API token */
	token: string;
	/** API URL (defaults to https://api.axiom.co, use https://api.eu.axiom.co for EU) */
	apiUrl?: string;
	/** Labels applied to ALL events in every batch (e.g., service name, environment) */
	labels?: Record<string, string>;
	/** Custom transform function to convert LogData to your preferred schema */
	transform?: (log: LogData) => Record<string, unknown>;
}

interface ForwarderConfig extends AxiomConfig {
	/** Flush interval in ms (default: 5000) */
	flushIntervalMs?: number;
	/** Flush when buffer reaches this size (default: 100) */
	flushThreshold?: number;
	/** Maximum buffer size before oldest items are discarded (default: 1000) */
	maxBatchSize?: number;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Safely stringify any value for log messages
 */
function stringifyArg(arg: unknown): string {
	if (arg === null) return "null";
	if (arg === undefined) return "undefined";
	if (typeof arg === "string") return arg;
	if (arg instanceof Error) return arg.stack || arg.message;
	try {
		return JSON.stringify(arg);
	} catch {
		return String(arg);
	}
}

/**
 * Default transform: converts LogData to Axiom event format
 */
function defaultTransform(log: LogData): Record<string, unknown> {
	return {
		// Axiom uses _time for the event timestamp
		_time: log.timestamp,
		// Log level
		level: log.level,
		// Logger namespace (omit if false/empty)
		namespace: log.namespace || undefined,
		// Human-readable message (all args joined)
		message: log.args.map(stringifyArg).join(" "),
		// Raw args for structured querying
		args: log.args,
		// Spread any metadata from getMeta()
		...log.meta,
	};
}

// -----------------------------------------------------------------------------
// Axiom Flusher Factory
// -----------------------------------------------------------------------------

/**
 * Creates a flusher function that sends batched logs to Axiom
 *
 * @example
 * ```ts
 * const flusher = createAxiomFlusher({
 *   dataset: "my-logs",
 *   token: "xaat-xxx",
 * });
 * const forwarder = createLogForwarder(flusher);
 * ```
 */
export function createAxiomFlusher(config: AxiomConfig) {
	const {
		dataset,
		token,
		apiUrl = "https://api.axiom.co",
		labels,
		transform = defaultTransform,
	} = config;

	const url = `${apiUrl}/v1/datasets/${dataset}/ingest`;

	return async (logs: LogData[]): Promise<boolean> => {
		// Transform all logs to Axiom event format
		const events = logs.map(transform);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					// Optional: apply labels to all events in the batch
					...(labels && {
						"X-Axiom-Event-Labels": JSON.stringify(labels),
					}),
				},
				body: JSON.stringify(events),
			});

			if (!response.ok) {
				// Log error but avoid using clog (circular dependency!)
				console.error(
					`[axiom-forwarder] Ingest failed: ${response.status} ${response.statusText}`
				);
				return false;
			}

			// Axiom returns: { ingested, failed, failures, processedBytes, ... }
			const result = await response.json();

			if (result.failed > 0) {
				console.error(
					`[axiom-forwarder] Partial failure: ${result.failed}/${logs.length} events failed`,
					result.failures
				);
			}

			// Return true only if all events were ingested
			return result.failed === 0;
		} catch (error) {
			console.error("[axiom-forwarder] Network error:", error);
			return false;
		}
	};
}

// -----------------------------------------------------------------------------
// Convenience: Combined Forwarder Factory
// -----------------------------------------------------------------------------

/**
 * Creates a complete log forwarder configured for Axiom
 *
 * @example
 * ```ts
 * const forwarder = createAxiomForwarder({
 *   dataset: "production-logs",
 *   token: Deno.env.get("AXIOM_TOKEN")!,
 *   labels: { service: "my-api", env: "production" },
 * });
 *
 * createClog.global.hook = forwarder.hook;
 * ```
 */
export function createAxiomForwarder(config: ForwarderConfig) {
	const {
		flushIntervalMs = 5000,
		flushThreshold = 100,
		maxBatchSize = 1000,
		...axiomConfig
	} = config;

	const flusher = createAxiomFlusher(axiomConfig);

	return createLogForwarder(flusher, {
		flushIntervalMs,
		flushThreshold,
		maxBatchSize,
	});
}

// -----------------------------------------------------------------------------
// Demo / Self-Test
// -----------------------------------------------------------------------------

if (import.meta.main) {
	const dataset = Deno.env.get("AXIOM_DATASET");
	const token = Deno.env.get("AXIOM_TOKEN");

	if (!dataset || !token) {
		console.log("Usage:");
		console.log(
			"  AXIOM_TOKEN=your-token AXIOM_DATASET=your-dataset deno run --allow-net --allow-env examples/axiom-forwarder.ts"
		);
		console.log("");
		console.log("Environment variables:");
		console.log("  AXIOM_TOKEN    - Your Axiom API token");
		console.log("  AXIOM_DATASET  - Your Axiom dataset name");
		console.log(
			"  AXIOM_API_URL  - (Optional) API URL for EU region or self-hosted"
		);
		Deno.exit(1);
	}

	// Create the forwarder
	const forwarder = createAxiomForwarder({
		dataset,
		token,
		apiUrl: Deno.env.get("AXIOM_API_URL"),
		labels: {
			service: "clog-example",
			environment: "development",
		},
		flushIntervalMs: 2000, // Shorter interval for demo
		flushThreshold: 5, // Lower threshold for demo
	});

	// Wire up to clog global hook
	createClog.global.hook = forwarder.hook;

	// Subscribe to state changes for visibility
	forwarder.subscribe((state) => {
		console.log(`[forwarder] Buffer: ${state.size}, Flushing: ${state.isFlushing}`);
	});

	// Create some loggers
	const clog = createClog("demo");
	const apiLog = createClog("demo:api");

	console.log("Sending test logs to Axiom...\n");

	// Generate some logs
	clog.log("Application started");
	clog.log("User logged in", { userId: 123, username: "alice" });
	apiLog.log("GET /api/users", { status: 200, duration: 45 });
	apiLog.warn("Slow query detected", { query: "SELECT * FROM users", duration: 1200 });
	clog.error("Connection failed", new Error("ECONNREFUSED"));

	console.log(`\nBuffer size: ${forwarder.size}`);
	console.log("Waiting for flush...\n");

	// Wait a bit then drain and exit
	setTimeout(async () => {
		console.log("Draining remaining logs...");
		await forwarder.drain();
		console.log("Done! Check your Axiom dataset for the logs.");
	}, 3000);
}
