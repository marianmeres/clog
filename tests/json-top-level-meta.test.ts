/**
 * jsonTopLevelMeta (meta keys promoted to the top level of a JSON line) and
 * toJsonRecord (the JSON line builder) tests
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	type Clog,
	createClog,
	type LogData,
	toJsonRecord,
	withNamespace,
} from "../src/clog.ts";
import { red } from "../src/colors.ts";
import { createLogForwarder } from "../src/forward.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	resetCapturedData,
	restoreConsole,
} from "./_helpers.ts";

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN = "00f067aa0ba902b7";

function captureHook() {
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};
}

// --- Promotion -------------------------------------------------------------

test("listed keys go to the top level, unlisted keys stay in meta", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ trace_id: TRACE, span_id: SPAN, user: "u1" });
	createClog.global.jsonTopLevelMeta = ["trace_id", "span_id"];

	createClog("api").log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.trace_id, TRACE);
	assert.deepEqual(output.span_id, SPAN);
	assert.deepEqual(output.meta, { user: "u1" });

	restoreConsole();
});

test("meta is omitted when every key was promoted", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ trace_id: TRACE });
	createClog.global.jsonTopLevelMeta = ["trace_id"];

	createClog("api").log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.trace_id, TRACE);
	assert(!("meta" in output));

	restoreConsole();
});

test("field order: core, promoted (list order), meta, arg_N, stack", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.stacktrace = 1;
	createClog.global.getMeta = () => ({ user: "u1", trace_id: TRACE, span_id: SPAN });
	createClog.global.jsonTopLevelMeta = ["span_id", "trace_id"];

	createClog("api").log("hello", { a: 1 });

	assert.deepEqual(Object.keys(JSON.parse(consoleOutput.log[0]!)), [
		"timestamp",
		"level",
		"logger",
		"message",
		"span_id",
		"trace_id",
		"meta",
		"arg_0",
		"stack",
	]);

	restoreConsole();
});

test("a listed key missing from meta, or undefined, produces no field", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ span_id: undefined, user: "u1" });
	createClog.global.jsonTopLevelMeta = ["trace_id", "span_id"];

	createClog("api").log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert(!("trace_id" in output));
	assert(!("span_id" in output));
	assert.deepEqual(output.meta, { user: "u1" });

	restoreConsole();
});

test("inherited properties are not promoted", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ user: "u1" });
	createClog.global.jsonTopLevelMeta = ["constructor", "toString"];

	createClog("api").log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert(!Object.hasOwn(output, "constructor"));
	assert(!Object.hasOwn(output, "toString"));
	assert.deepEqual(output.meta, { user: "u1" });

	restoreConsole();
});

test("values are promoted as they are", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ n: 0, f: false, z: null, o: { a: [1] } });
	createClog.global.jsonTopLevelMeta = ["n", "f", "z", "o"];

	createClog("api").log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.n, 0);
	assert.deepEqual(output.f, false);
	assert.deepEqual(output.z, null);
	assert.deepEqual(output.o, { a: [1] });
	assert(!("meta" in output));

	restoreConsole();
});

test("keys from instance config.meta are promoted too", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ user: "u1" });
	createClog.global.jsonTopLevelMeta = ["trace_id"];

	createClog("api", { meta: () => ({ trace_id: TRACE }) }).log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.trace_id, TRACE);
	assert.deepEqual(output.meta, { user: "u1" });

	restoreConsole();
});

// --- Resolution --------------------------------------------------------------

test("an instance list replaces the global one", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ trace_id: TRACE, user: "u1" });
	createClog.global.jsonTopLevelMeta = ["trace_id"];

	createClog("api", { jsonTopLevelMeta: ["user"] }).log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.user, "u1");
	assert(!("trace_id" in output));
	assert.deepEqual(output.meta, { trace_id: TRACE });

	restoreConsole();
});

test("an instance [] turns promotion off for that logger (and its children)", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ trace_id: TRACE });
	createClog.global.jsonTopLevelMeta = ["trace_id"];

	const clog = createClog("api", { jsonTopLevelMeta: [] });
	clog.log("hello");
	withNamespace(clog, "child").log("hello");

	for (const line of consoleOutput.log) {
		const output = JSON.parse(line);
		assert(!("trace_id" in output));
		assert.deepEqual(output.meta, { trace_id: TRACE });
	}

	restoreConsole();
});

test("a global list set after the logger was created applies", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ trace_id: TRACE });
	const clog = createClog("api");

	createClog.global.jsonTopLevelMeta = ["trace_id"];
	clog.log("hello");

	assert.deepEqual(JSON.parse(consoleOutput.log[0]!).trace_id, TRACE);

	restoreConsole();
});

test("reset() clears the global list", () => {
	reset();
	createClog.global.jsonTopLevelMeta = ["trace_id"];
	createClog.reset();
	assert.deepEqual(createClog.global.jsonTopLevelMeta, undefined);

	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ trace_id: TRACE });
	createClog("api").log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert(!("trace_id" in output));
	assert.deepEqual(output.meta, { trace_id: TRACE });

	restoreConsole();
});

// --- Name clashes ------------------------------------------------------------

test("a key named like a default core field stays in meta", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.stacktrace = 1;
	const meta = {
		timestamp: "m-ts",
		level: "m-level",
		logger: "m-logger",
		message: "m-message",
		meta: "m-meta",
		stack: "m-stack",
		trace_id: TRACE,
	};
	createClog.global.getMeta = () => meta;
	createClog.global.jsonTopLevelMeta = Object.keys(meta);

	createClog("api").log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.match(output.timestamp, /^\d{4}-\d{2}-\d{2}T/);
	assert.deepEqual(output.level, "INFO");
	assert.deepEqual(output.logger, "api");
	assert.deepEqual(output.message, "hello");
	assert(output.stack.includes("Stack:"));
	assert.deepEqual(output.trace_id, TRACE);
	const { trace_id: _, ...rest } = meta;
	assert.deepEqual(output.meta, rest);

	restoreConsole();
});

test("a key named like a renamed core field stays in meta", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.jsonFieldNames = { logger: "logger.name", meta: "context" };
	createClog.global.getMeta = () => ({
		"logger.name": "m-logger",
		context: "m-context",
		// the default names are free once renamed
		logger: "m-logger-default",
	});
	createClog.global.jsonTopLevelMeta = ["logger.name", "context", "logger"];

	createClog("api").log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output["logger.name"], "api");
	assert.deepEqual(output.logger, "m-logger-default");
	assert.deepEqual(output.context, { "logger.name": "m-logger", context: "m-context" });

	restoreConsole();
});

test("a key of the form <arg>_<n> stays in meta", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ arg_0: "m0", arg_7: "m7", arg_x: "mx" });
	createClog.global.jsonTopLevelMeta = ["arg_0", "arg_7", "arg_x"];

	createClog("api").log("hello", "real");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.arg_0, "real");
	assert(!("arg_7" in output), "reserved even when the line has no such arg");
	assert.deepEqual(output.arg_x, "mx");
	assert.deepEqual(output.meta, { arg_0: "m0", arg_7: "m7" });

	restoreConsole();
});

test("the reserved <arg>_<n> form follows a renamed arg prefix", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.jsonFieldNames = { arg: "extra" };
	createClog.global.getMeta = () => ({ extra_0: "m0", arg_0: "a0" });
	createClog.global.jsonTopLevelMeta = ["extra_0", "arg_0"];

	createClog("api").log("hello", "real");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.extra_0, "real");
	assert.deepEqual(output.arg_0, "a0");
	assert.deepEqual(output.meta, { extra_0: "m0" });

	restoreConsole();
});

// --- Presentation only -------------------------------------------------------

test("a hook and a custom writer still see every meta key", () => {
	reset();
	captureHook();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ trace_id: TRACE, user: "u1" });
	createClog.global.jsonTopLevelMeta = ["trace_id"];

	// capturedData is read after the default writer has promoted
	createClog("api").log("hello");
	const written: LogData[] = [];
	createClog("api", { writer: (d) => written.push(d) }).log("hello");

	assert.deepEqual(capturedData[0]!.meta, { trace_id: TRACE, user: "u1" });
	assert.deepEqual(capturedData[1]!.meta, { trace_id: TRACE, user: "u1" });
	assert.deepEqual(written[0]!.meta, { trace_id: TRACE, user: "u1" });

	restoreConsole();
});

test("the forwarder still sees every meta key", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ trace_id: TRACE, user: "u1" });
	createClog.global.jsonTopLevelMeta = ["trace_id"];
	const forwarder = createLogForwarder(() => Promise.resolve(true), {}, false);
	createClog.global.hook = forwarder.hook;

	createClog("api").log("hello");

	assert.deepEqual(JSON.parse(consoleOutput.log[0]!).trace_id, TRACE);
	assert.deepEqual(forwarder.dump()[0]!.meta, { trace_id: TRACE, user: "u1" });

	forwarder.reset();
	restoreConsole();
});

test("a static config.meta object is not mutated", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.jsonTopLevelMeta = ["trace_id"];
	const meta = { trace_id: TRACE, user: "u1" };

	createClog("api", { meta }).log("hello");
	createClog("api", { getMeta: () => meta }).log("hello");

	assert.deepEqual(meta, { trace_id: TRACE, user: "u1" });
	for (const line of consoleOutput.log) {
		assert.deepEqual(JSON.parse(line).trace_id, TRACE);
	}

	restoreConsole();
});

test("text output is unchanged", () => {
	reset();
	createClog.global.getMeta = () => ({ trace_id: TRACE });

	createClog("api").log("hello");
	createClog.global.jsonTopLevelMeta = ["trace_id"];
	createClog("api").log("hello");

	const strip = (s: string) => s.replace(/^\[[^\]]+\]/, "[ts]");
	assert.deepEqual(strip(consoleOutput.log[1]!), strip(consoleOutput.log[0]!));
	assert(!consoleOutput.log[1]!.includes(TRACE));

	restoreConsole();
});

test("browser output is unchanged", async () => {
	reset();
	// biome-ignore lint/suspicious/noExplicitAny: installs browser globals
	const g = globalThis as any;
	const prevWindow = Object.getOwnPropertyDescriptor(g, "window");
	Object.defineProperty(g, "window", { value: { document: {} }, configurable: true });
	try {
		// A fresh module instance, so runtime detection sees the browser global.
		// Global config is shared across instances. The specifier stays a literal
		// so Deno loads it with the module graph (no --allow-read needed).
		const mod: typeof import("../src/clog.ts") = await import(
			// @ts-expect-error tsc cannot resolve a query-string specifier
			"../src/clog.ts?browser-top-level-meta"
		);
		createClog.global.jsonOutput = true;
		createClog.global.getMeta = () => ({ trace_id: TRACE });

		mod.createClog("api").log("hello");
		createClog.global.jsonTopLevelMeta = ["trace_id"];
		mod.createClog("api").log("hello");

		assert.deepEqual(consoleOutput.log, ["[api] hello", "[api] hello"]);
	} finally {
		if (prevWindow) Object.defineProperty(g, "window", prevWindow);
		else delete g.window;
		restoreConsole();
	}
});

// --- Styled args on Deno ------------------------------------------------------

// Regression: on Deno the %c path ran before the JSON check, so a line with
// styled args was written as text even with jsonOutput on.
test("styled args still produce JSON on Deno", () => {
	reset();
	createClog.global.jsonOutput = true;

	createClog("api").log(red("styled"), "x");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.message, "styled");
	assert.deepEqual(output.arg_0, "x");

	restoreConsole();
});

// --- toJsonRecord ------------------------------------------------------------

/** Logs once through the default writer; returns the parsed line and its data. */
function logOnce(clog: Clog, ...args: unknown[]) {
	resetCapturedData();
	clog.error(...args);
	return { line: JSON.parse(consoleOutput.error.at(-1)!), data: capturedData[0]! };
}

test("toJsonRecord equals the default writer's line", () => {
	reset();
	captureHook();
	createClog.global.jsonOutput = true;
	createClog.global.stacktrace = 2;
	createClog.global.jsonFieldNames = { logger: "logger.name", arg: "extra" };
	createClog.global.getMeta = () => ({ trace_id: TRACE, span_id: SPAN, user: "u1" });
	createClog.global.jsonTopLevelMeta = ["trace_id", "span_id"];

	const cases: [Clog, ...unknown[]][] = [
		[createClog("api"), "plain", { a: 1 }],
		[createClog("api"), "with error", new Error("boom")],
		[createClog("api"), red("styled"), "x"],
		[createClog("api", { stringify: true }), { a: 1 }, [1, 2], red("s")],
		[createClog(false, { jsonFieldNames: { meta: "ctx" } }), "renamed"],
		[createClog("api", { jsonTopLevelMeta: [] }), "no promotion"],
		[createClog("api", { getMeta: () => ({ user: "u2" }) }), "no match"],
	];
	for (const [clog, ...args] of cases) {
		const { line, data } = logOnce(clog, ...args);
		assert.deepEqual(toJsonRecord(data), line);
	}

	restoreConsole();
});

test("toJsonRecord works on a hand-built LogData with no config", () => {
	reset();
	createClog.global.jsonTopLevelMeta = ["trace_id"];

	const record = toJsonRecord({
		level: "WARNING",
		namespace: "FE:ui",
		args: ["from browser", new Error("boom")],
		timestamp: "2026-10-01T00:00:00.000Z",
		meta: { trace_id: TRACE, agent: "a1" },
	});

	assert.deepEqual(record.timestamp, "2026-10-01T00:00:00.000Z");
	assert.deepEqual(record.level, "WARNING");
	assert.deepEqual(record.logger, "FE:ui");
	assert.deepEqual(record.message, "from browser");
	assert.deepEqual(record.trace_id, TRACE);
	assert.deepEqual(record.meta, { agent: "a1" });
	assert(String(record.arg_0).includes("Error: boom"));
	assert(!("stack" in record));

	restoreConsole();
});

test("toJsonRecord ignores jsonOutput and concat", () => {
	reset();
	createClog.global.concat = true;

	const record = toJsonRecord({
		level: "INFO",
		namespace: "api",
		args: ["hello", { a: 1 }],
		timestamp: "2026-10-01T00:00:00.000Z",
		config: { concat: true, jsonOutput: false },
	});

	assert.deepEqual(record, {
		timestamp: "2026-10-01T00:00:00.000Z",
		level: "INFO",
		logger: "api",
		message: "hello",
		arg_0: { a: 1 },
	});

	restoreConsole();
});

test("toJsonRecord never calls getMeta and has no side effects", () => {
	reset();
	let calls = 0;
	let hooked = 0;
	createClog.global.getMeta = () => {
		calls++;
		return { from: "global" };
	};
	createClog.global.hook = () => void hooked++;

	const record = toJsonRecord({
		level: "INFO",
		namespace: "api",
		args: ["hello"],
		timestamp: "2026-10-01T00:00:00.000Z",
		config: {
			getMeta: () => {
				calls++;
				return { from: "instance" };
			},
		},
	});

	assert.deepEqual(calls, 0);
	assert.deepEqual(hooked, 0);
	assert(!("meta" in record));
	assert.deepEqual(Object.values(consoleOutput).flat(), []);

	restoreConsole();
});

test("toJsonRecord does not mutate data.meta", () => {
	reset();
	createClog.global.jsonTopLevelMeta = ["trace_id"];
	const meta = { trace_id: TRACE, user: "u1" };

	const record = toJsonRecord({
		level: "INFO",
		namespace: "api",
		args: ["hello"],
		timestamp: "2026-10-01T00:00:00.000Z",
		meta,
	});

	assert.deepEqual(meta, { trace_id: TRACE, user: "u1" });
	assert(record.meta !== meta);

	restoreConsole();
});
