import assert from "node:assert/strict";
import { test } from "node:test";
import { createClog, type LogData } from "../src/clog.ts";
import { createLogForwarder } from "../src/forward.ts";

// Helper to wait for async operations
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Reset clog between tests
function reset() {
	createClog.reset();
}

test("creates forwarder successfully", () => {
	const forwarder = createLogForwarder(async () => true, {
		flushIntervalMs: 0,
	});

	assert(forwarder);
	assert(typeof forwarder.hook === "function");
	assert(typeof forwarder.add === "function");
	assert(typeof forwarder.flush === "function");
	assert(typeof forwarder.drain === "function");
	assert(typeof forwarder.start === "function");
	assert(typeof forwarder.stop === "function");
	assert(typeof forwarder.reset === "function");
	assert(typeof forwarder.dump === "function");
	assert(typeof forwarder.configure === "function");
	assert(typeof forwarder.subscribe === "function");

	forwarder.stop();
});

test("hook adds items to batch", async () => {
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push(logs);
			return true;
		},
		{ flushIntervalMs: 0 }, // disable auto-flush
	);

	forwarder.stop(); // ensure no auto-flush

	const testData: LogData = {
		level: "INFO",
		namespace: "test",
		args: ["hello"],
		timestamp: new Date().toISOString(),
	};

	forwarder.hook(testData);

	assert.deepEqual(forwarder.size, 1);
	assert.deepEqual(forwarder.dump().length, 1);
	assert.deepEqual(forwarder.dump()[0], testData);

	await forwarder.drain();
});

test("flush calls flusher function", async () => {
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push([...logs]);
			return true;
		},
		{ flushIntervalMs: 0 },
	);

	forwarder.stop();

	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["msg1"],
		timestamp: new Date().toISOString(),
	});

	forwarder.add({
		level: "WARNING",
		namespace: "test",
		args: ["msg2"],
		timestamp: new Date().toISOString(),
	});

	assert.deepEqual(forwarder.size, 2);

	await forwarder.flush();

	assert.deepEqual(received.length, 1);
	assert.deepEqual(received[0]!.length, 2);
	assert.deepEqual(received[0]![0]!.args[0], "msg1");
	assert.deepEqual(received[0]![1]!.args[0], "msg2");
	assert.deepEqual(forwarder.size, 0);

	await forwarder.drain();
});

test("drain flushes and stops", async () => {
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push([...logs]);
			return true;
		},
		{ flushIntervalMs: 1000 },
	);

	assert(forwarder.isRunning);

	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["final"],
		timestamp: new Date().toISOString(),
	});

	const result = await forwarder.drain();

	assert(result);
	assert.deepEqual(received.length, 1);
	assert.deepEqual(received[0]![0]!.args[0], "final");
	assert.deepEqual(forwarder.isRunning, false);
});

test("subscribe receives state updates", async () => {
	const states: { size: number; isRunning: boolean; isFlushing: boolean }[] = [];

	const forwarder = createLogForwarder(async () => true, {
		flushIntervalMs: 0,
	});

	forwarder.stop();

	const unsubscribe = forwarder.subscribe((state) => {
		states.push({ ...state });
	});

	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["msg"],
		timestamp: new Date().toISOString(),
	});

	// Give time for subscription to fire
	await delay(10);

	assert(states.length > 0);
	assert(states.some((s) => s.size === 1));

	unsubscribe();
	await forwarder.drain();
});

test("properties work correctly", async () => {
	const forwarder = createLogForwarder(async () => true, {
		flushIntervalMs: 1000,
	});

	assert.deepEqual(forwarder.size, 0);
	assert(forwarder.isRunning);
	assert.deepEqual(forwarder.isFlushing, false);

	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["msg"],
		timestamp: new Date().toISOString(),
	});

	assert.deepEqual(forwarder.size, 1);

	forwarder.stop();
	assert.deepEqual(forwarder.isRunning, false);

	forwarder.start();
	assert(forwarder.isRunning);

	await forwarder.drain();
});

test("reset clears buffer", async () => {
	const forwarder = createLogForwarder(async () => true, {
		flushIntervalMs: 0,
	});

	forwarder.stop();

	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["msg"],
		timestamp: new Date().toISOString(),
	});

	assert.deepEqual(forwarder.size, 1);

	forwarder.reset();

	assert.deepEqual(forwarder.size, 0);

	await forwarder.drain();
});

test("configure updates settings", async () => {
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push([...logs]);
			return true;
		},
		{ flushIntervalMs: 0, flushThreshold: 10 },
	);

	forwarder.stop();

	// Change threshold to 2
	forwarder.configure({ flushThreshold: 2 });

	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["msg1"],
		timestamp: new Date().toISOString(),
	});

	assert.deepEqual(received.length, 0); // not yet at threshold

	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["msg2"],
		timestamp: new Date().toISOString(),
	});

	// Give time for threshold flush
	await delay(10);

	assert.deepEqual(received.length, 1); // threshold triggered flush
	assert.deepEqual(received[0]!.length, 2);

	await forwarder.drain();
});

test("integration with clog global hook", async () => {
	reset();
	const received: LogData[][] = [];

	// IMPORTANT: use no-op logger to avoid circular loop
	// (BatchFlusher uses clog internally for debug output)
	const noopLogger = {
		debug: () => {},
		log: () => {},
		warn: () => {},
		error: () => {},
	};
	const forwarder = createLogForwarder(
		async (logs) => {
			received.push([...logs]);
			return true;
		},
		// biome-ignore lint/suspicious/noExplicitAny: a partial config on purpose
		{ flushIntervalMs: 0, logger: noopLogger } as any,
	);

	forwarder.stop();

	// Wire up to clog global hook
	createClog.global.hook = forwarder.hook;

	// Suppress console output
	createClog.global.writer = () => {};

	const clog = createClog("test");

	clog.log("hello");
	clog.warn("warning");
	clog.error("error");

	assert.deepEqual(forwarder.size, 3);

	await forwarder.flush();

	assert.deepEqual(received.length, 1);
	assert.deepEqual(received[0]!.length, 3);
	assert.deepEqual(received[0]![0]!.args[0], "hello");
	assert.deepEqual(received[0]![0]!.level, "INFO");
	assert.deepEqual(received[0]![1]!.args[0], "warning");
	assert.deepEqual(received[0]![1]!.level, "WARNING");
	assert.deepEqual(received[0]![2]!.args[0], "error");
	assert.deepEqual(received[0]![2]!.level, "ERROR");

	await forwarder.drain();
	reset();
});

test("autostart parameter", async () => {
	reset(); // ensure no global hook is set (avoids circular loop with batch debug)

	// With autostart = true (default)
	const forwarder1 = createLogForwarder(async () => true, {
		flushIntervalMs: 1000,
	});
	assert(forwarder1.isRunning);
	await forwarder1.drain();

	// With autostart = false
	const forwarder2 = createLogForwarder(
		async () => true,
		{ flushIntervalMs: 1000 },
		false,
	);
	assert.deepEqual(forwarder2.isRunning, false);
	await forwarder2.drain();
});

test("flushThreshold triggers immediate flush", async () => {
	reset(); // ensure no global hook is set (avoids circular loop with batch debug)
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push([...logs]);
			return true;
		},
		{ flushIntervalMs: 0, flushThreshold: 3 },
	);

	forwarder.stop();

	// Add items below threshold
	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["1"],
		timestamp: new Date().toISOString(),
	});
	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["2"],
		timestamp: new Date().toISOString(),
	});

	assert.deepEqual(received.length, 0);

	// Add item that triggers threshold
	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["3"],
		timestamp: new Date().toISOString(),
	});

	// Give time for flush
	await delay(10);

	assert.deepEqual(received.length, 1);
	assert.deepEqual(received[0]!.length, 3);

	await forwarder.drain();
});

test("hook resolves meta at log time, not at flush time", async () => {
	reset();
	const received: LogData[] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push(...logs);
			return true;
		},
		{ flushIntervalMs: 0 },
	);
	forwarder.stop();

	createClog.global.hook = forwarder.hook;
	createClog.global.writer = () => {}; // silent, and does not read meta

	let requestId = "r1";
	createClog.global.getMeta = () => ({ requestId });
	let attempt = 1;
	const clog = createClog("test", { meta: () => ({ attempt }) });

	clog.log("first");
	requestId = "r2";
	attempt = 2;
	clog.log("second");
	requestId = "after";
	attempt = 99;

	await forwarder.flush();

	assert.deepEqual(
		received.map((d) => d.meta),
		[
			{ requestId: "r1", attempt: 1 },
			{ requestId: "r2", attempt: 2 },
		],
	);

	reset();
	await forwarder.drain();
});
