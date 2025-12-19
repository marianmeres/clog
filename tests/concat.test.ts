/**
 * Concat mode tests
 */

import { assert, assertEquals, assertMatch } from "@std/assert";
import { createClog } from "../src/clog.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";

Deno.test("global flag produces single string output", () => {
	reset();
	createClog.global.concat = true;

	const clog = createClog("test");
	clog.log("msg", { key: "value" }, [1, 2, 3]);

	assertEquals(consoleOutput.log.length, 1);
	// Should be a single concatenated string with namespace
	const output = consoleOutput.log[0];
	assert(output.includes("[test]"));
	assert(output.includes("msg"));
	assert(output.includes('{"key":"value"}'));
	assert(output.includes("[1,2,3]"));
	// Verify it's formatted as: [timestamp] [LEVEL] [ns] args
	assertMatch(output, /^\[\d{4}-\d{2}-\d{2}T.*\] \[INFO\] \[test\] msg/);

	restoreConsole();
});

Deno.test("per-instance config works", () => {
	reset();

	const clog = createClog("test", { concat: true });
	clog.log("hello", { foo: "bar" });

	assertEquals(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0];
	assert(output.includes("[test]"));
	assert(output.includes("hello"));
	assert(output.includes('{"foo":"bar"}'));

	restoreConsole();
});

Deno.test("instance true overrides global false", () => {
	reset();
	createClog.global.concat = false;

	const clog = createClog("test", { concat: true });
	clog.log("msg", { key: "value" });

	assertEquals(consoleOutput.log.length, 1);
	// Should still be concatenated
	assert(consoleOutput.log[0].includes('{"key":"value"}'));
	assert(consoleOutput.log[0].includes("[test]"));
	assert(consoleOutput.log[0].includes("msg"));

	restoreConsole();
});

Deno.test("instance false overrides global true", () => {
	reset();
	createClog.global.concat = true;

	const clog = createClog("test", { concat: false });
	clog.log("msg", { key: "value" });

	assertEquals(consoleOutput.log.length, 1);
	// Should NOT be concatenated (multiple args joined by mock)
	// The mock joins with space, but objects won't be stringified
	assert(!consoleOutput.log[0].includes('{"key":"value"}'));

	restoreConsole();
});

Deno.test("all args joined with spaces", () => {
	reset();
	createClog.global.concat = true;

	const clog = createClog("x");
	clog.log(1, "two", { three: 3 });

	assertEquals(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0];
	// Args should be: 1 two {"three":3}
	assert(output.includes('1 two {"three":3}'));

	restoreConsole();
});

Deno.test("handles null and undefined", () => {
	reset();
	createClog.global.concat = true;

	const clog = createClog("test");
	clog.log("values:", null, undefined, "end");

	assertEquals(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0];
	assert(output.includes("values: null undefined end"));

	restoreConsole();
});

Deno.test("works without namespace", () => {
	reset();
	createClog.global.concat = true;

	const clog = createClog();
	clog.log("msg", { data: 1 });

	assertEquals(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0];
	// Should have timestamp and level but no [namespace]
	assertMatch(output, /^\[\d{4}-\d{2}-\d{2}T.*\] \[INFO\] msg \{"data":1\}$/);

	restoreConsole();
});

Deno.test("reset() clears global concat", () => {
	createClog.global.concat = true;

	createClog.reset();

	assertEquals(createClog.global.concat, undefined);
});

Deno.test("works with all log levels", () => {
	reset();
	createClog.global.concat = true;

	const clog = createClog("test");

	clog.debug("debug", { level: "DEBUG" });
	clog.log("log", { level: "INFO" });
	clog.warn("warn", { level: "WARNING" });
	clog.error("error", { level: "ERROR" });

	assertEquals(consoleOutput.debug.length, 1);
	assertEquals(consoleOutput.log.length, 1);
	assertEquals(consoleOutput.warn.length, 1);
	assertEquals(consoleOutput.error.length, 1);

	assert(consoleOutput.debug[0].includes("[DEBUG]"));
	assert(consoleOutput.log[0].includes("[INFO]"));
	assert(consoleOutput.warn[0].includes("[WARNING]"));
	assert(consoleOutput.error[0].includes("[ERROR]"));

	restoreConsole();
});
