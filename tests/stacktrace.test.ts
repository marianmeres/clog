/**
 * Stacktrace mode tests
 */

import { assert, assertEquals } from "@std/assert";
import { createClog } from "../src/clog.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";

Deno.test("global flag appends stack trace", () => {
	reset();
	createClog.global.stacktrace = true;

	const clog = createClog("test");
	clog.log("msg");

	assertEquals(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0];
	assert(output.includes("[test]"));
	assert(output.includes("msg"));
	// Stack trace should contain "at " lines
	assert(output.includes("at "), "Stack trace should be present");

	restoreConsole();
});

Deno.test("per-instance config works", () => {
	reset();

	const clog = createClog("test", { stacktrace: true });
	clog.log("hello");

	assertEquals(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0];
	assert(output.includes("[test]"));
	assert(output.includes("hello"));
	assert(output.includes("at "), "Stack trace should be present");

	restoreConsole();
});

Deno.test("instance true overrides global false", () => {
	reset();
	createClog.global.stacktrace = false;

	const clog = createClog("test", { stacktrace: true });
	clog.log("msg");

	assertEquals(consoleOutput.log.length, 1);
	assert(
		consoleOutput.log[0].includes("at "),
		"Stack trace should be present"
	);

	restoreConsole();
});

Deno.test("instance false overrides global true", () => {
	reset();
	createClog.global.stacktrace = true;

	const clog = createClog("test", { stacktrace: false });
	clog.log("msg");

	assertEquals(consoleOutput.log.length, 1);
	// Stack trace should NOT be present when instance config is false
	assert(
		!consoleOutput.log[0].includes("at "),
		"Stack trace should not be present"
	);

	restoreConsole();
});

Deno.test("number limits frame count", () => {
	reset();
	createClog.global.stacktrace = 2;

	const clog = createClog("test");
	clog.log("msg");

	assertEquals(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0];
	// Should have limited frames - count "at " occurrences
	const atCount = (output.match(/\bat\b/g) || []).length;
	assert(atCount <= 2, `Expected at most 2 stack frames, got ${atCount}`);

	restoreConsole();
});

Deno.test("works with JSON output", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.stacktrace = true;

	const clog = createClog("test");
	clog.log("msg");

	assertEquals(consoleOutput.log.length, 1);
	const parsed = JSON.parse(consoleOutput.log[0]);
	assertEquals(parsed.message, "msg");
	assertEquals(parsed.namespace, "test");
	assert(parsed.stack, "Stack field should be present in JSON output");
	assert(parsed.stack.includes("at "), "Stack should contain 'at ' frames");

	restoreConsole();
});

Deno.test("works with concat mode", () => {
	reset();
	createClog.global.concat = true;
	createClog.global.stacktrace = true;

	const clog = createClog("test");
	clog.log("msg", { key: "value" });

	assertEquals(consoleOutput.log.length, 1);
	const output = consoleOutput.log[0];
	// Should have concatenated message AND stack trace
	assert(output.includes("[test]"));
	assert(output.includes("msg"));
	assert(output.includes('{"key":"value"}'));
	assert(output.includes("at "), "Stack trace should be present");

	restoreConsole();
});

Deno.test("reset() clears global stacktrace", () => {
	createClog.global.stacktrace = true;
	createClog.reset();

	assertEquals(createClog.global.stacktrace, undefined);
});

Deno.test("works with all log levels", () => {
	reset();
	createClog.global.stacktrace = true;

	const clog = createClog("test");
	clog.debug("debug");
	clog.log("log");
	clog.warn("warn");
	clog.error("error");

	assertEquals(consoleOutput.debug.length, 1);
	assertEquals(consoleOutput.log.length, 1);
	assertEquals(consoleOutput.warn.length, 1);
	assertEquals(consoleOutput.error.length, 1);

	assert(consoleOutput.debug[0].includes("at "), "debug should have stack");
	assert(consoleOutput.log[0].includes("at "), "log should have stack");
	assert(consoleOutput.warn[0].includes("at "), "warn should have stack");
	assert(consoleOutput.error[0].includes("at "), "error should have stack");

	restoreConsole();
});
