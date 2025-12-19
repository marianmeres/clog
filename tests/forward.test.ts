import { assert, assertEquals } from "@std/assert";
import { createClog, type LogData } from "../src/clog.ts";
import { createLogForwarder, type LogForwarder } from "../src/forward.ts";

// Helper to wait for async operations
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Reset clog between tests
function reset() {
	createClog.reset();
}

Deno.test("creates forwarder successfully", () => {
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

Deno.test("hook adds items to batch", async () => {
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push(logs);
			return true;
		},
		{ flushIntervalMs: 0 } // disable auto-flush
	);

	forwarder.stop(); // ensure no auto-flush

	const testData: LogData = {
		level: "INFO",
		namespace: "test",
		args: ["hello"],
		timestamp: new Date().toISOString(),
	};

	forwarder.hook(testData);

	assertEquals(forwarder.size, 1);
	assertEquals(forwarder.dump().length, 1);
	assertEquals(forwarder.dump()[0], testData);

	await forwarder.drain();
});

Deno.test("flush calls flusher function", async () => {
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push([...logs]);
			return true;
		},
		{ flushIntervalMs: 0 }
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

	assertEquals(forwarder.size, 2);

	await forwarder.flush();

	assertEquals(received.length, 1);
	assertEquals(received[0].length, 2);
	assertEquals(received[0][0].args[0], "msg1");
	assertEquals(received[0][1].args[0], "msg2");
	assertEquals(forwarder.size, 0);

	await forwarder.drain();
});

Deno.test("drain flushes and stops", async () => {
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push([...logs]);
			return true;
		},
		{ flushIntervalMs: 1000 }
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
	assertEquals(received.length, 1);
	assertEquals(received[0][0].args[0], "final");
	assertEquals(forwarder.isRunning, false);
});

Deno.test("subscribe receives state updates", async () => {
	const states: { size: number; isRunning: boolean; isFlushing: boolean }[] =
		[];

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

Deno.test("properties work correctly", async () => {
	const forwarder = createLogForwarder(async () => true, {
		flushIntervalMs: 1000,
	});

	assertEquals(forwarder.size, 0);
	assert(forwarder.isRunning);
	assertEquals(forwarder.isFlushing, false);

	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["msg"],
		timestamp: new Date().toISOString(),
	});

	assertEquals(forwarder.size, 1);

	forwarder.stop();
	assertEquals(forwarder.isRunning, false);

	forwarder.start();
	assert(forwarder.isRunning);

	await forwarder.drain();
});

Deno.test("reset clears buffer", async () => {
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

	assertEquals(forwarder.size, 1);

	forwarder.reset();

	assertEquals(forwarder.size, 0);

	await forwarder.drain();
});

Deno.test("configure updates settings", async () => {
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push([...logs]);
			return true;
		},
		{ flushIntervalMs: 0, flushThreshold: 10 }
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

	assertEquals(received.length, 0); // not yet at threshold

	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["msg2"],
		timestamp: new Date().toISOString(),
	});

	// Give time for threshold flush
	await delay(10);

	assertEquals(received.length, 1); // threshold triggered flush
	assertEquals(received[0].length, 2);

	await forwarder.drain();
});

Deno.test("integration with clog global hook", async () => {
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
		// deno-lint-ignore no-explicit-any
		{ flushIntervalMs: 0, logger: noopLogger } as any
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

	assertEquals(forwarder.size, 3);

	await forwarder.flush();

	assertEquals(received.length, 1);
	assertEquals(received[0].length, 3);
	assertEquals(received[0][0].args[0], "hello");
	assertEquals(received[0][0].level, "INFO");
	assertEquals(received[0][1].args[0], "warning");
	assertEquals(received[0][1].level, "WARNING");
	assertEquals(received[0][2].args[0], "error");
	assertEquals(received[0][2].level, "ERROR");

	await forwarder.drain();
	reset();
});

Deno.test("autostart parameter", async () => {
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
		false
	);
	assertEquals(forwarder2.isRunning, false);
	await forwarder2.drain();
});

Deno.test("flushThreshold triggers immediate flush", async () => {
	reset(); // ensure no global hook is set (avoids circular loop with batch debug)
	const received: LogData[][] = [];

	const forwarder = createLogForwarder(
		async (logs) => {
			received.push([...logs]);
			return true;
		},
		{ flushIntervalMs: 0, flushThreshold: 3 }
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

	assertEquals(received.length, 0);

	// Add item that triggers threshold
	forwarder.add({
		level: "INFO",
		namespace: "test",
		args: ["3"],
		timestamp: new Date().toISOString(),
	});

	// Give time for flush
	await delay(10);

	assertEquals(received.length, 1);
	assertEquals(received[0].length, 3);

	await forwarder.drain();
});
