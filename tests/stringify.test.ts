/**
 * Stringify mode tests
 */

import { assert, assertEquals } from "@std/assert";
import { createClog } from "../src/clog.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";

Deno.test("global flag stringifies objects", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test");
	clog.log("msg", { key: "value" }, [1, 2, 3]);

	assertEquals(consoleOutput.log.length, 1);
	// Objects should be JSON stringified
	assert(consoleOutput.log[0].includes('{"key":"value"}'));
	assert(consoleOutput.log[0].includes("[1,2,3]"));

	restoreConsole();
});

Deno.test("primitives pass through unchanged", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test");
	clog.log("string", 123, true, null, undefined);

	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes("string"));
	assert(consoleOutput.log[0].includes("123"));
	assert(consoleOutput.log[0].includes("true"));

	restoreConsole();
});

Deno.test("per-instance config works", () => {
	reset();

	const clog = createClog("test", { stringify: true });
	clog.log("msg", { key: "value" });

	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes('{"key":"value"}'));

	restoreConsole();
});

Deno.test("instance true overrides global false", () => {
	reset();
	createClog.global.stringify = false;

	const clog = createClog("test", { stringify: true });
	clog.log("msg", { key: "value" });

	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes('{"key":"value"}'));

	restoreConsole();
});

Deno.test("instance false overrides global true", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test", { stringify: false });
	clog.log("msg", { key: "value" });

	assertEquals(consoleOutput.log.length, 1);
	// Object should NOT be stringified (will show as [object Object] in join)
	assert(!consoleOutput.log[0].includes('{"key":"value"}'));

	restoreConsole();
});

Deno.test("works with JSON output mode", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.stringify = true;

	const clog = createClog("test");
	clog.log("msg", { nested: { deep: "value" } });

	assertEquals(consoleOutput.log.length, 1);

	// Parse the JSON output
	const output = JSON.parse(consoleOutput.log[0]);
	// The arg_0 should be a string (stringified), not an object
	assertEquals(typeof output.arg_0, "string");
	assertEquals(output.arg_0, '{"nested":{"deep":"value"}}');

	restoreConsole();
});

Deno.test("handles circular references gracefully", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test");
	// deno-lint-ignore no-explicit-any
	const circular: any = { a: 1 };
	circular.self = circular;

	// Should not throw
	clog.log("msg", circular);

	assertEquals(consoleOutput.log.length, 1);
	// Should fall back to String() which gives [object Object]
	assert(consoleOutput.log[0].includes("[object Object]"));

	restoreConsole();
});

Deno.test("reset() clears global stringify", () => {
	createClog.global.stringify = true;

	createClog.reset();

	assertEquals(createClog.global.stringify, undefined);
});

Deno.test("works with all log levels", () => {
	reset();
	createClog.global.stringify = true;

	const clog = createClog("test");
	const obj = { level: "test" };

	clog.debug("debug", obj);
	clog.log("log", obj);
	clog.warn("warn", obj);
	clog.error("error", obj);

	assertEquals(consoleOutput.debug.length, 1);
	assertEquals(consoleOutput.log.length, 1);
	assertEquals(consoleOutput.warn.length, 1);
	assertEquals(consoleOutput.error.length, 1);

	assert(consoleOutput.debug[0].includes('{"level":"test"}'));
	assert(consoleOutput.log[0].includes('{"level":"test"}'));
	assert(consoleOutput.warn[0].includes('{"level":"test"}'));
	assert(consoleOutput.error[0].includes('{"level":"test"}'));

	restoreConsole();
});
