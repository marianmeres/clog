/**
 * Stacktrace mode tests
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createClog, type LogData, withNamespace } from "../src/clog.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";
import { logFromHelper } from "./fixtures/clog.ts";

/** Collects `LogData.stack` of every log call through a global writer. */
function captureStacks(): (string[] | undefined)[] {
	const stacks: (string[] | undefined)[] = [];
	createClog.global.writer = (data: LogData) => {
		stacks.push(data.stack);
	};
	createClog.global.stacktrace = true;
	return stacks;
}

test("global flag appends stack trace", () => {
	reset();
	createClog.global.stacktrace = true;

	const clog = createClog("test");
	clog.log("msg");

	assert.deepEqual(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0]!;
	assert(output.includes("[test]"));
	assert(output.includes("msg"));
	// Stack trace should contain "at " lines
	assert(output.includes("at "), "Stack trace should be present");

	restoreConsole();
});

test("per-instance config works", () => {
	reset();

	const clog = createClog("test", { stacktrace: true });
	clog.log("hello");

	assert.deepEqual(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0]!;
	assert(output.includes("[test]"));
	assert(output.includes("hello"));
	assert(output.includes("at "), "Stack trace should be present");

	restoreConsole();
});

test("instance true overrides global false", () => {
	reset();
	createClog.global.stacktrace = false;

	const clog = createClog("test", { stacktrace: true });
	clog.log("msg");

	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes("at "), "Stack trace should be present");

	restoreConsole();
});

test("instance false overrides global true", () => {
	reset();
	createClog.global.stacktrace = true;

	const clog = createClog("test", { stacktrace: false });
	clog.log("msg");

	assert.deepEqual(consoleOutput.log.length, 1);
	// Stack trace should NOT be present when instance config is false
	assert(!consoleOutput.log[0]!.includes("at "), "Stack trace should not be present");

	restoreConsole();
});

test("number limits frame count", () => {
	reset();
	createClog.global.stacktrace = 2;

	const clog = createClog("test");
	clog.log("msg");

	assert.deepEqual(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0]!;
	// Should have limited frames - count "at " occurrences
	const atCount = (output.match(/\bat\b/g) || []).length;
	assert(atCount <= 2, `Expected at most 2 stack frames, got ${atCount}`);

	restoreConsole();
});

test("works with JSON output", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.stacktrace = true;

	const clog = createClog("test");
	clog.log("msg");

	assert.deepEqual(consoleOutput.log.length, 1);
	const parsed = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(parsed.message, "msg");
	// 3.18: default JSON field is "logger" (was "namespace")
	assert.deepEqual(parsed.logger, "test");
	assert(parsed.stack, "Stack field should be present in JSON output");
	assert(parsed.stack.includes("at "), "Stack should contain 'at ' frames");

	restoreConsole();
});

test("works with concat mode", () => {
	reset();
	createClog.global.concat = true;
	createClog.global.stacktrace = true;

	const clog = createClog("test");
	clog.log("msg", { key: "value" });

	assert.deepEqual(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0]!;
	// Should have concatenated message AND stack trace
	assert(output.includes("[test]"));
	assert(output.includes("msg"));
	assert(output.includes('{"key":"value"}'));
	assert(output.includes("at "), "Stack trace should be present");

	restoreConsole();
});

test("reset() clears global stacktrace", () => {
	createClog.global.stacktrace = true;
	createClog.reset();

	assert.deepEqual(createClog.global.stacktrace, undefined);
});

test("works with all log levels", () => {
	reset();
	createClog.global.stacktrace = true;

	const clog = createClog("test");
	clog.debug("debug");
	clog.log("log");
	clog.warn("warn");
	clog.error("error");

	assert.deepEqual(consoleOutput.debug.length, 1);
	assert.deepEqual(consoleOutput.log.length, 1);
	assert.deepEqual(consoleOutput.warn.length, 1);
	assert.deepEqual(consoleOutput.error.length, 1);

	assert(consoleOutput.debug[0]!.includes("at "), "debug should have stack");
	assert(consoleOutput.log[0]!.includes("at "), "log should have stack");
	assert(consoleOutput.warn[0]!.includes("at "), "warn should have stack");
	assert(consoleOutput.error[0]!.includes("at "), "error should have stack");

	restoreConsole();
});

test("first frame is the log call, for every entry point", () => {
	reset();
	const stacks = captureStacks();

	const clog = createClog("test");
	clog("callable");
	clog.debug("debug");
	clog.log("log");
	clog.warn("warn");
	clog.error("error");
	withNamespace(clog, "child").log("child");

	assert.equal(stacks.length, 6);
	for (const stack of stacks) {
		assert(stack![0]!.includes(import.meta.url), `not the caller's: ${stack![0]}`);
	}

	restoreConsole();
});

test("a consumer file named clog.ts keeps its frames", () => {
	reset();
	const stacks = captureStacks();

	logFromHelper(createClog("test"));

	const helper = new URL("./fixtures/clog.ts", import.meta.url).href;
	assert(stacks[0]![0]!.includes(helper), `not the helper's: ${stacks[0]![0]}`);
	assert(stacks[0]![1]!.includes(import.meta.url), `not the test's: ${stacks[0]![1]}`);

	restoreConsole();
});
