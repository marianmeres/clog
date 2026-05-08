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
	assertEquals(output.logger, "api");
	assertEquals(output.message, "Request received");
	assertEquals(output.arg_0, { method: "GET" });
	assert(output.timestamp);
	// pre-3.18 emitted the field as "namespace"; default is now "logger"
	assert(!("namespace" in output));

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
		/^\[\d{4}-\d{2}-\d{2}T.*\] \[WARNING\] \[api\] Slow query/,
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

// --- jsonFieldNames: per-field rename map -------------------------------

Deno.test("jsonFieldNames: instance config renames a single field", () => {
	reset();
	const clog = createClog("api", {
		jsonOutput: true,
		jsonFieldNames: { logger: "namespace" },
	});
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]);
	assertEquals(output.namespace, "api");
	assert(!("logger" in output), "default 'logger' must be replaced");
	// Untouched defaults remain.
	assertEquals(output.message, "hello");
	assertEquals(output.level, "INFO");

	restoreConsole();
});

Deno.test("jsonFieldNames: global config renames fields for all instances", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.jsonFieldNames = {
		timestamp: "@timestamp",
		level: "severity",
		logger: "logger.name",
		message: "msg",
	};

	const clog = createClog("api");
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]);
	assert(output["@timestamp"]);
	assertEquals(output.severity, "INFO");
	assertEquals(output["logger.name"], "api");
	assertEquals(output.msg, "hello");
	// Defaults must not also appear.
	assert(!("timestamp" in output));
	assert(!("level" in output));
	assert(!("logger" in output));
	assert(!("message" in output));

	restoreConsole();
});

Deno.test("jsonFieldNames: instance config overrides global per-key", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.jsonFieldNames = { logger: "service", level: "severity" };

	const clog = createClog("api", {
		jsonFieldNames: { logger: "logger.name" }, // override one
	});
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]);
	// instance wins for "logger"
	assertEquals(output["logger.name"], "api");
	assert(!("service" in output));
	// global still applies for the un-overridden key
	assertEquals(output.severity, "INFO");
	assert(!("level" in output));

	restoreConsole();
});

Deno.test("jsonFieldNames: arg key controls the prefix for arg_N fields", () => {
	reset();
	const clog = createClog("api", {
		jsonOutput: true,
		jsonFieldNames: { arg: "extra" },
	});
	clog.log("hello", { a: 1 }, { b: 2 });

	const output = JSON.parse(consoleOutput.log[0]);
	assertEquals(output.message, "hello");
	assertEquals(output.extra_0, { a: 1 });
	assertEquals(output.extra_1, { b: 2 });
	assert(!("arg_0" in output));
	assert(!("arg_1" in output));

	restoreConsole();
});

Deno.test("jsonFieldNames: meta and stack keys can be renamed", () => {
	reset();
	createClog.global.stacktrace = 3;

	const clog = createClog("api", {
		jsonOutput: true,
		jsonFieldNames: { meta: "context", stack: "trace" },
		getMeta: () => ({ requestId: "req-1" }),
	});
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]);
	assertEquals(output.context, { requestId: "req-1" });
	assert(typeof output.trace === "string");
	assert(output.trace.includes("Stack:"));
	assert(!("meta" in output));
	assert(!("stack" in output));

	restoreConsole();
});

Deno.test("jsonFieldNames: omitted keys keep their default names", () => {
	reset();
	const clog = createClog("api", {
		jsonOutput: true,
		jsonFieldNames: { logger: "service" },
	});
	clog.log("hello", { extra: true });

	const output = JSON.parse(consoleOutput.log[0]);
	assertEquals(output.service, "api");
	// Everything else still uses defaults.
	assert(output.timestamp);
	assertEquals(output.level, "INFO");
	assertEquals(output.message, "hello");
	assertEquals(output.arg_0, { extra: true });

	restoreConsole();
});

Deno.test("jsonFieldNames: renamed logger field still omitted when namespace is false", () => {
	reset();
	const clog = createClog(false, {
		jsonOutput: true,
		jsonFieldNames: { logger: "service" },
	});
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]);
	// Renamed key must also be omitted (not just the default name)
	assert(!("service" in output), "renamed logger field must be omitted");
	assert(!("logger" in output));
	assertEquals(output.message, "hello");

	restoreConsole();
});

Deno.test("jsonFieldNames: createClog.reset() clears global jsonFieldNames", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.jsonFieldNames = { logger: "service" };

	createClog.reset();
	// Re-enable jsonOutput so we can inspect the JSON
	createClog.global.jsonOutput = true;

	const clog = createClog("api");
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]);
	assertEquals(output.logger, "api");
	assert(!("service" in output));

	restoreConsole();
});
