/**
 * JSON output format tests
 */

import { assert, assertEquals, assertMatch } from "@std/assert";
import { createClog } from "../src/clog.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";

Deno.test("JSON output format in server mode", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("api");
	clog.log("Request received", { method: "GET" });

	assertEquals(consoleOutput.log.length, 1);

	// Parse JSON output
	const output = JSON.parse(consoleOutput.log[0]);
	assertEquals(output.level, "INFO");
	assertEquals(output.namespace, "api");
	assertEquals(output.message, "Request received");
	assertEquals(output.arg_0, { method: "GET" });
	assert(output.timestamp);

	restoreConsole();
});

Deno.test("JSON output preserves Error stacks", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("test");
	const err = new Error("Test error");
	clog.error("Failed", err);

	assertEquals(consoleOutput.error.length, 1);

	const output = JSON.parse(consoleOutput.error[0]);
	assertEquals(output.message, "Failed");
	assert(output.arg_0.includes("Error: Test error"));
	assert(output.arg_0.includes("at ")); // stack trace

	restoreConsole();
});

Deno.test("text output format in server mode", () => {
	reset();
	createClog.global.jsonOutput = false;

	const clog = createClog("api");
	clog.warn("Slow query");

	assertEquals(consoleOutput.warn.length, 1);

	const output = consoleOutput.warn[0];
	// Format: [timestamp] [LEVEL] [namespace] message
	assertMatch(
		output,
		/^\[\d{4}-\d{2}-\d{2}T.*\] \[WARNING\] \[api\] Slow query/
	);

	restoreConsole();
});

Deno.test("no namespace in output when namespace is false", () => {
	reset();
	createClog.global.jsonOutput = false;

	const clog = createClog(false);
	clog.log("message");

	assertEquals(consoleOutput.log.length, 1);

	const output = consoleOutput.log[0];
	// Should not have [namespace] part
	assertMatch(output, /^\[\d{4}-\d{2}-\d{2}T.*\] \[INFO\] message/);
	assert(!output.includes("[]"));

	restoreConsole();
});
