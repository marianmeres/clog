/**
 * JSON output format tests
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createClog } from "../src/clog.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";

test("JSON output format in server mode", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("api");
	clog.log("Request received", { method: "GET" });

	assert.deepEqual(consoleOutput.log.length, 1);

	// Parse JSON output
	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.level, "INFO");
	assert.deepEqual(output.logger, "api");
	assert.deepEqual(output.message, "Request received");
	assert.deepEqual(output.arg_0, { method: "GET" });
	assert(output.timestamp);
	// pre-3.18 emitted the field as "namespace"; default is now "logger"
	assert(!("namespace" in output));

	restoreConsole();
});

test("JSON output preserves Error stacks", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("test");
	const err = new Error("Test error");
	clog.error("Failed", err);

	assert.deepEqual(consoleOutput.error.length, 1);

	const output = JSON.parse(consoleOutput.error[0]!);
	assert.deepEqual(output.message, "Failed");
	assert(output.arg_0.includes("Error: Test error"));
	assert(output.arg_0.includes("at ")); // stack trace

	restoreConsole();
});

test("text output format in server mode", () => {
	reset();
	createClog.global.jsonOutput = false;

	const clog = createClog("api");
	clog.warn("Slow query");

	assert.deepEqual(consoleOutput.warn.length, 1);

	const output = consoleOutput.warn[0]!;
	// Format: [timestamp] [LEVEL] [namespace] message
	assert.match(output, /^\[\d{4}-\d{2}-\d{2}T.*\] \[WARNING\] \[api\] Slow query/);

	restoreConsole();
});

test("no namespace in output when namespace is false", () => {
	reset();
	createClog.global.jsonOutput = false;

	const clog = createClog(false);
	clog.log("message");

	assert.deepEqual(consoleOutput.log.length, 1);

	const output = consoleOutput.log[0]!;
	// Should not have [namespace] part
	assert.match(output, /^\[\d{4}-\d{2}-\d{2}T.*\] \[INFO\] message/);
	assert(!output.includes("[]"));

	restoreConsole();
});

// --- jsonFieldNames: per-field rename map -------------------------------

test("jsonFieldNames: instance config renames a single field", () => {
	reset();
	const clog = createClog("api", {
		jsonOutput: true,
		jsonFieldNames: { logger: "namespace" },
	});
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.namespace, "api");
	assert(!("logger" in output), "default 'logger' must be replaced");
	// Untouched defaults remain.
	assert.deepEqual(output.message, "hello");
	assert.deepEqual(output.level, "INFO");

	restoreConsole();
});

test("jsonFieldNames: global config renames fields for all instances", () => {
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

	const output = JSON.parse(consoleOutput.log[0]!);
	assert(output["@timestamp"]);
	assert.deepEqual(output.severity, "INFO");
	assert.deepEqual(output["logger.name"], "api");
	assert.deepEqual(output.msg, "hello");
	// Defaults must not also appear.
	assert(!("timestamp" in output));
	assert(!("level" in output));
	assert(!("logger" in output));
	assert(!("message" in output));

	restoreConsole();
});

test("jsonFieldNames: instance config overrides global per-key", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.jsonFieldNames = { logger: "service", level: "severity" };

	const clog = createClog("api", {
		jsonFieldNames: { logger: "logger.name" }, // override one
	});
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	// instance wins for "logger"
	assert.deepEqual(output["logger.name"], "api");
	assert(!("service" in output));
	// global still applies for the un-overridden key
	assert.deepEqual(output.severity, "INFO");
	assert(!("level" in output));

	restoreConsole();
});

test("jsonFieldNames: arg key controls the prefix for arg_N fields", () => {
	reset();
	const clog = createClog("api", {
		jsonOutput: true,
		jsonFieldNames: { arg: "extra" },
	});
	clog.log("hello", { a: 1 }, { b: 2 });

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.message, "hello");
	assert.deepEqual(output.extra_0, { a: 1 });
	assert.deepEqual(output.extra_1, { b: 2 });
	assert(!("arg_0" in output));
	assert(!("arg_1" in output));

	restoreConsole();
});

test("jsonFieldNames: meta and stack keys can be renamed", () => {
	reset();
	createClog.global.stacktrace = 3;

	const clog = createClog("api", {
		jsonOutput: true,
		jsonFieldNames: { meta: "context", stack: "trace" },
		getMeta: () => ({ requestId: "req-1" }),
	});
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.context, { requestId: "req-1" });
	assert(typeof output.trace === "string");
	assert(output.trace.includes("Stack:"));
	assert(!("meta" in output));
	assert(!("stack" in output));

	restoreConsole();
});

test("jsonFieldNames: omitted keys keep their default names", () => {
	reset();
	const clog = createClog("api", {
		jsonOutput: true,
		jsonFieldNames: { logger: "service" },
	});
	clog.log("hello", { extra: true });

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.service, "api");
	// Everything else still uses defaults.
	assert(output.timestamp);
	assert.deepEqual(output.level, "INFO");
	assert.deepEqual(output.message, "hello");
	assert.deepEqual(output.arg_0, { extra: true });

	restoreConsole();
});

test("jsonFieldNames: renamed logger field still omitted when namespace is false", () => {
	reset();
	const clog = createClog(false, {
		jsonOutput: true,
		jsonFieldNames: { logger: "service" },
	});
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	// Renamed key must also be omitted (not just the default name)
	assert(!("service" in output), "renamed logger field must be omitted");
	assert(!("logger" in output));
	assert.deepEqual(output.message, "hello");

	restoreConsole();
});

test("jsonFieldNames: createClog.reset() clears global jsonFieldNames", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.jsonFieldNames = { logger: "service" };

	createClog.reset();
	// Re-enable jsonOutput so we can inspect the JSON
	createClog.global.jsonOutput = true;

	const clog = createClog("api");
	clog.log("hello");

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.logger, "api");
	assert(!("service" in output));

	restoreConsole();
});

// Regression: colorWriter previously ignored jsonOutput, so loggers created with
// a `color` option emitted bracketed text even when JSON output was requested.
test("color + global jsonOutput emits JSON", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("COLORED", { color: "green" });
	clog.log({ hello: "world" });

	assert.deepEqual(consoleOutput.log.length, 1);
	const line = consoleOutput.log[0]!;

	const output = JSON.parse(line);
	assert.deepEqual(output.logger, "COLORED");
	assert.deepEqual(output.level, "INFO");
	assert.deepEqual(output.message, { hello: "world" });

	assert(!line.includes("[INFO]"));
	assert(!line.includes("%c"));
	assert(!line.includes("color:"));

	restoreConsole();
});

test("color + per-instance jsonOutput:true overrides global false", () => {
	reset();
	createClog.global.jsonOutput = false;

	const clog = createClog("COLORED", { color: "green", jsonOutput: true });
	clog.log({ hello: "world" });

	assert.deepEqual(consoleOutput.log.length, 1);
	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.logger, "COLORED");
	assert.deepEqual(output.message, { hello: "world" });

	restoreConsole();
});

test("color + per-instance jsonOutput:false still emits colored text", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("COLORED", { color: "green", jsonOutput: false });
	clog.log("hello");

	assert.deepEqual(consoleOutput.log.length, 1);
	const line = consoleOutput.log[0]!;

	assert.match(line, /^\[\d{4}-\d{2}-\d{2}T.*\] \[INFO\] /);
	assert(line.includes("COLORED"));

	restoreConsole();
});

test("color + jsonOutput preserves Error stacks", () => {
	reset();
	createClog.global.jsonOutput = true;

	const clog = createClog("COLORED", { color: "green" });
	clog.error("Failed", new Error("boom"));

	assert.deepEqual(consoleOutput.error.length, 1);
	const output = JSON.parse(consoleOutput.error[0]!);
	assert.deepEqual(output.logger, "COLORED");
	assert.deepEqual(output.message, "Failed");
	assert(output.arg_0.includes("Error: boom"));
	assert(output.arg_0.includes("at "));

	restoreConsole();
});
