/**
 * Stringify mode tests
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createClog } from "../src/clog.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";

test("global flag stringifies objects", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test");
	clog.log("msg", { key: "value" }, [1, 2, 3]);

	assert.deepEqual(consoleOutput.log.length, 1);
	// Objects should be JSON stringified
	assert(consoleOutput.log[0]!.includes('{"key":"value"}'));
	assert(consoleOutput.log[0]!.includes("[1,2,3]"));

	restoreConsole();
});

test("primitives pass through unchanged", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test");
	clog.log("string", 123, true, null, undefined);

	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes("string"));
	assert(consoleOutput.log[0]!.includes("123"));
	assert(consoleOutput.log[0]!.includes("true"));

	restoreConsole();
});

test("per-instance config works", () => {
	reset();

	const clog = createClog("test", { stringify: true });
	clog.log("msg", { key: "value" });

	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes('{"key":"value"}'));

	restoreConsole();
});

test("instance true overrides global false", () => {
	reset();
	createClog.global.stringify = false;

	const clog = createClog("test", { stringify: true });
	clog.log("msg", { key: "value" });

	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes('{"key":"value"}'));

	restoreConsole();
});

test("instance false overrides global true", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test", { stringify: false });
	clog.log("msg", { key: "value" });

	assert.deepEqual(consoleOutput.log.length, 1);
	// Object should NOT be stringified (will show as [object Object] in join)
	assert(!consoleOutput.log[0]!.includes('{"key":"value"}'));

	restoreConsole();
});

test("works with JSON output mode", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.stringify = true;

	const clog = createClog("test");
	clog.log("msg", { nested: { deep: "value" } });

	assert.deepEqual(consoleOutput.log.length, 1);

	// Parse the JSON output
	const output = JSON.parse(consoleOutput.log[0]!);
	// The arg_0 should be a string (stringified), not an object
	assert.deepEqual(typeof output.arg_0, "string");
	assert.deepEqual(output.arg_0, '{"nested":{"deep":"value"}}');

	restoreConsole();
});

test("handles circular references gracefully", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test");
	// biome-ignore lint/suspicious/noExplicitAny: builds a circular object
	const circular: any = { a: 1 };
	circular.self = circular;

	// Should not throw
	clog.log("msg", circular);

	assert.deepEqual(consoleOutput.log.length, 1);
	// Should fall back to String() which gives [object Object]
	assert(consoleOutput.log[0]!.includes("[object Object]"));

	restoreConsole();
});

test("reset() clears global stringify", () => {
	createClog.global.stringify = true;

	createClog.reset();

	assert.deepEqual(createClog.global.stringify, undefined);
});

test("works with all log levels", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test");
	const obj = { level: "test" };

	clog.debug("debug", obj);
	clog.log("log", obj);
	clog.warn("warn", obj);
	clog.error("error", obj);

	assert.deepEqual(consoleOutput.debug.length, 1);
	assert.deepEqual(consoleOutput.log.length, 1);
	assert.deepEqual(consoleOutput.warn.length, 1);
	assert.deepEqual(consoleOutput.error.length, 1);

	assert(consoleOutput.debug[0]!.includes('{"level":"test"}'));
	assert(consoleOutput.log[0]!.includes('{"level":"test"}'));
	assert(consoleOutput.warn[0]!.includes('{"level":"test"}'));
	assert(consoleOutput.error[0]!.includes('{"level":"test"}'));

	restoreConsole();
});
