/**
 * withNamespace wrapper tests
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createClog, withNamespace } from "../src/clog.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";

test("basic wrapping with clog", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	moduleLogger.log("hello");

	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes("[app]"));
	assert(consoleOutput.log[0]!.includes("[module]"));
	assert(consoleOutput.log[0]!.includes("hello"));

	restoreConsole();
});

test("callable interface", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	// Direct call should proxy to log
	moduleLogger("called directly");

	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes("[module]"));
	assert(consoleOutput.log[0]!.includes("called directly"));

	restoreConsole();
});

test("all log levels work", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	moduleLogger.debug("debug msg");
	moduleLogger.log("log msg");
	moduleLogger.warn("warn msg");
	moduleLogger.error("error msg");

	assert.deepEqual(consoleOutput.debug.length, 1);
	assert.deepEqual(consoleOutput.log.length, 1);
	assert.deepEqual(consoleOutput.warn.length, 1);
	assert.deepEqual(consoleOutput.error.length, 1);

	assert(consoleOutput.debug[0]!.includes("[module]"));
	assert(consoleOutput.log[0]!.includes("[module]"));
	assert(consoleOutput.warn[0]!.includes("[module]"));
	assert(consoleOutput.error[0]!.includes("[module]"));

	restoreConsole();
});

test("returns first argument as string", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	assert.deepEqual(moduleLogger.log("hello"), "hello");
	assert.deepEqual(moduleLogger.debug("debug"), "debug");
	assert.deepEqual(moduleLogger.warn(123), "123");
	assert.deepEqual(moduleLogger.error({ msg: "err" }), "[object Object]");
	assert.deepEqual(moduleLogger.log(), "");
	assert.deepEqual(moduleLogger("callable"), "callable");

	restoreConsole();
});

test("return value works for throw pattern", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	try {
		throw new Error(moduleLogger.error("Something failed"));
		// biome-ignore lint/suspicious/noExplicitAny: reads e.message
	} catch (e: any) {
		assert.deepEqual(e.message, "Something failed");
	}

	assert.deepEqual(consoleOutput.error.length, 1);
	assert(consoleOutput.error[0]!.includes("[module]"));
	assert(consoleOutput.error[0]!.includes("Something failed"));

	restoreConsole();
});

test("deep nesting", () => {
	reset();
	const clog = createClog("app");
	const level1 = withNamespace(clog, "module");
	const level2 = withNamespace(level1, "sub");
	const level3 = withNamespace(level2, "deep");

	level3.log("deeply nested");

	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes("[app]"));
	assert(consoleOutput.log[0]!.includes("[module]"));
	assert(consoleOutput.log[0]!.includes("[sub]"));
	assert(consoleOutput.log[0]!.includes("[deep]"));
	assert(consoleOutput.log[0]!.includes("deeply nested"));

	restoreConsole();
});

test("deep nesting return value pattern", () => {
	reset();
	const clog = createClog("app");
	const level1 = withNamespace(clog, "module");
	const level2 = withNamespace(level1, "sub");

	try {
		throw new Error(level2.error("Deep failure"));
		// biome-ignore lint/suspicious/noExplicitAny: reads e.message
	} catch (e: any) {
		assert.deepEqual(e.message, "Deep failure");
	}

	restoreConsole();
});

test("works with native console", () => {
	reset();
	const logger = withNamespace(console, "my-module");

	logger.log("hello from console wrapper");

	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes("[my-module]"));
	assert(consoleOutput.log[0]!.includes("hello from console wrapper"));

	restoreConsole();
});

test("preserves parent debug suppression", () => {
	reset();
	const clog = createClog("app", { debug: false });
	const moduleLogger = withNamespace(clog, "module");

	// Parent's debug is suppressed, so wrapped debug should also be suppressed
	moduleLogger.debug("should not appear");

	// Note: the wrapped logger still calls parent.debug, which is a no-op
	assert.deepEqual(consoleOutput.debug.length, 0);

	// Other methods should work
	moduleLogger.log("log works");
	assert.deepEqual(consoleOutput.log.length, 1);

	restoreConsole();
});
