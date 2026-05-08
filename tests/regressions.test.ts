/**
 * Regression tests for bugs/flaws addressed in 3.16.
 *
 * Each test is labelled with its origin (B1/B2/...) from the re-analysis plan.
 * These would have failed against the pre-3.16 implementation.
 */

import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
	CLOG_SKIP,
	createClog,
	createNoopClog,
	formatStack,
	type LogData,
	withNamespace,
} from "../src/clog.ts";
import { autoColor } from "../src/colors.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	resetCapturedData,
	restoreConsole,
} from "./_helpers.ts";

// --- B1: getMeta throwing must not crash the log call --------------------

Deno.test("B1: throwing getMeta does not crash the log call", () => {
	reset();
	const clog = createClog("test", {
		getMeta: () => {
			throw new Error("meta boom");
		},
	});

	// If unhandled, this throws and fails the test
	const returned = clog.log("hello");

	assertEquals(returned, "hello");
	assertEquals(consoleOutput.log.length, 1);

	restoreConsole();
});

Deno.test("B1: throwing getMeta leaves meta undefined for writers", () => {
	reset();
	let seenMeta: unknown = "sentinel";
	createClog.global.writer = (data: LogData) => {
		seenMeta = data.meta;
	};

	const clog = createClog("test", {
		getMeta: () => {
			throw new Error("meta boom");
		},
	});
	clog.log("hello");

	assertEquals(seenMeta, undefined);

	restoreConsole();
});

Deno.test("B1: throwing getMeta is ignored in JSON output", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("api", {
		getMeta: () => {
			throw new Error("meta boom");
		},
	});
	clog.log("ping");

	assertEquals(consoleOutput.log.length, 1);
	const parsed = JSON.parse(consoleOutput.log[0]);
	assertEquals(parsed.message, "ping");
	assert(!("meta" in parsed), "meta field must be absent when getMeta throws");

	restoreConsole();
});

// --- B2: return value mirrors logged representation ---------------------

Deno.test("B2: stringify mode returns JSON-rendered first arg", () => {
	reset();
	const clog = createClog("test", { stringify: true });

	const ret = clog.error({ code: 500, message: "boom" });

	assertEquals(ret, '{"code":500,"message":"boom"}');
	// And the logged line must contain the same JSON shape
	assert(consoleOutput.error[0].includes('{"code":500,"message":"boom"}'));

	restoreConsole();
});

Deno.test("B2: concat mode returns JSON-rendered first arg", () => {
	reset();
	const clog = createClog("test", { concat: true });

	const ret = clog.error({ code: 500 }, "extra");

	assertEquals(ret, '{"code":500}');

	restoreConsole();
});

Deno.test("B2: throw-new-Error pattern works under stringify", () => {
	reset();
	const clog = createClog("test", { stringify: true });

	try {
		throw new Error(clog.error({ problem: "bad" }));
		// deno-lint-ignore no-explicit-any
	} catch (e: any) {
		assertEquals(e.message, '{"problem":"bad"}');
	}

	restoreConsole();
});

Deno.test("B2: plain mode still returns String(first arg)", () => {
	reset();
	const clog = createClog("test");

	assertEquals(clog.error({ msg: "err" }), "[object Object]");
	assertEquals(clog.log(123), "123");
	assertEquals(clog.log(), "");

	restoreConsole();
});

// --- B3: withNamespace composes namespace for structured output ---------

Deno.test("B3: composed namespace appears in LogData.namespace", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => pushCapturedData(data);

	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	moduleLogger.log("hello");

	assertEquals(capturedData.length, 1);
	assertEquals(capturedData[0].namespace, "app:module");
	// And message is the real message, not the namespace marker
	assertEquals(capturedData[0].args[0], "hello");

	restoreConsole();
});

Deno.test("B3: withNamespace JSON output has composed namespace", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");
	moduleLogger.log("hello");

	assertEquals(consoleOutput.log.length, 1);
	const parsed = JSON.parse(consoleOutput.log[0]);
	// 3.18: default JSON field is "logger" (was "namespace")
	assertEquals(parsed.logger, "app:module");
	assertEquals(parsed.message, "hello");

	restoreConsole();
});

Deno.test("B3: deep nesting composes further", () => {
	reset();
	const clog = createClog("app");
	const l1 = withNamespace(clog, "module");
	const l2 = withNamespace(l1, "sub");
	const l3 = withNamespace(l2, "deep");

	assertEquals((l3 as { ns: string | false }).ns, "app:module:sub:deep");

	restoreConsole();
});

Deno.test("B3: text output still shows multi-bracket format", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");
	moduleLogger.log("hello");

	const line = consoleOutput.log[0];
	// "[app] [module]" — each segment bracketed separately for readability
	assert(line.includes("[app] [module]"), `got: ${line}`);
	assert(line.includes("hello"));

	restoreConsole();
});

Deno.test("B3: withNamespace on native console keeps arg-prefix behavior", () => {
	reset();
	const logger = withNamespace(console, "native");
	logger.log("hello");

	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes("[native]"));
	assert(consoleOutput.log[0].includes("hello"));

	restoreConsole();
});

Deno.test("B3: withNamespace inherits parent config", () => {
	reset();
	const clog = createClog("app", { debug: false });
	const child = withNamespace(clog, "module");

	child.debug("should be suppressed");

	assertEquals(consoleOutput.debug.length, 0);

	restoreConsole();
});

// --- B4: stack capture survives withNamespace wrapper --------------------

Deno.test("B4: stacktrace through withNamespace shows caller frames", () => {
	reset();
	const clog = createClog("app", { stacktrace: true });
	const child = withNamespace(clog, "module");

	child.log("msg");

	assertEquals(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0];
	assert(output.includes("at "), "stack must be present");
	// No internal clog frame should leak into the filtered output
	assert(
		!/at\s+_apply\b/.test(output),
		`internal _apply frame leaked: ${output}`
	);
});

Deno.test("B4: stacktrace available to custom writers via LogData.stack", () => {
	reset();
	let receivedStack: string[] | undefined;
	createClog.global.writer = (data: LogData) => {
		receivedStack = data.stack;
	};
	createClog.global.stacktrace = 3;

	const clog = createClog("test");
	clog.log("msg");

	assert(receivedStack !== undefined, "custom writer should receive stack");
	assert(receivedStack!.length > 0);
	assert(receivedStack!.length <= 3);
	// formatStack should produce the same output the default writer uses
	const formatted = formatStack(receivedStack!);
	assert(formatted.includes("Stack:"));

	restoreConsole();
});

// --- D2: args are shallow-cloned, hook mutation does not leak -----------

Deno.test("D2: mutating data.args in hook does not affect caller array", () => {
	reset();
	createClog.global.hook = (data: LogData) => {
		data.args[0] = "redacted";
		data.args.push("appended");
	};

	const clog = createClog("test");
	const original = ["secret", 42];
	clog.log(...original);

	// Caller's array must not be touched
	assertEquals(original, ["secret", 42]);

	restoreConsole();
});

// --- D4: instance-level jsonOutput --------------------------------------

Deno.test("D4: instance jsonOutput true overrides global false", () => {
	reset();
	createClog.global.jsonOutput = false;

	const clog = createClog("api", { jsonOutput: true });
	clog.log("msg");

	assertEquals(consoleOutput.log.length, 1);
	// Must be parseable JSON
	const parsed = JSON.parse(consoleOutput.log[0]);
	assertEquals(parsed.message, "msg");
	// 3.18: default JSON field is "logger" (was "namespace")
	assertEquals(parsed.logger, "api");

	restoreConsole();
});

Deno.test("D4: instance jsonOutput false overrides global true", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("api", { jsonOutput: false });
	clog.log("msg");

	assertEquals(consoleOutput.log.length, 1);
	// Must NOT be JSON — just plain text
	let parsed = null;
	try {
		parsed = JSON.parse(consoleOutput.log[0]);
	} catch {
		/* expected */
	}
	assertEquals(parsed, null, "output should not be valid JSON");
	assert(consoleOutput.log[0].includes("[api]"));

	restoreConsole();
});

// --- D7: logger field omitted from JSON when namespace is false ---------

Deno.test("D7: JSON output omits logger field when namespace is false", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog(); // no namespace
	clog.log("msg");

	const parsed = JSON.parse(consoleOutput.log[0]);
	assert(!("logger" in parsed), "logger field must be absent");
	// And the legacy "namespace" must not sneak back in either.
	assert(!("namespace" in parsed));
	assertEquals(parsed.message, "msg");

	restoreConsole();
});

// --- I4: CLOG_SKIP sentinel suppresses writer ---------------------------

Deno.test("I4: hook returning CLOG_SKIP suppresses the writer", () => {
	reset();
	createClog.global.hook = (data: LogData) => {
		if (data.args[0] === "drop") return CLOG_SKIP;
	};

	const clog = createClog("test");
	clog.log("keep");
	clog.log("drop");
	clog.log("keep2");

	assertEquals(consoleOutput.log.length, 2);
	assert(consoleOutput.log[0].includes("keep"));
	assert(consoleOutput.log[1].includes("keep2"));

	restoreConsole();
});

Deno.test("I4: hook returning CLOG_SKIP still returns first-arg string", () => {
	reset();
	createClog.global.hook = () => CLOG_SKIP;

	const clog = createClog("test");
	const ret = clog.error("dropped");
	assertEquals(ret, "dropped");
	assertEquals(consoleOutput.error.length, 0);

	restoreConsole();
});

// --- D5: createNoopClog signature accepts false ------------------------

Deno.test("D5: createNoopClog accepts `false` as namespace", () => {
	const clog = createNoopClog(false);
	assertEquals(clog.ns, false);
});

// --- D10: getMeta is lazy (not called when no consumer reads .meta) ----

Deno.test("D10: getMeta not invoked when no consumer reads data.meta", () => {
	reset();
	let calls = 0;
	const clog = createClog("test", {
		getMeta: () => {
			calls++;
			return { x: 1 };
		},
	});

	// Default writer in plain text mode does not read .meta
	clog.log("msg");
	assertEquals(calls, 0);

	restoreConsole();
});

Deno.test("D10: getMeta invoked once when consumer reads data.meta", () => {
	reset();
	let calls = 0;
	createClog.global.writer = (data) => {
		// read multiple times — should still only call once
		void data.meta;
		void data.meta;
		void data.meta;
	};

	const clog = createClog("test", {
		getMeta: () => {
			calls++;
			return { x: 1 };
		},
	});
	clog.log("msg");

	assertEquals(calls, 1);

	restoreConsole();
});

// --- I1: autoColor memoization ------------------------------------------

Deno.test("I1: autoColor returns identical value across calls", () => {
	const a = autoColor("some-ns");
	const b = autoColor("some-ns");
	const c = autoColor("other-ns");
	assertEquals(a, b);
	// Not strictly required to differ, but should for two distinct hashes
	// in this specific palette / these specific strings
	assertNotEquals(a, c);
});
