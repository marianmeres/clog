/**
 * withNamespace wrapper tests
 */

import { assert, assertEquals } from "@std/assert";
import { createClog, withNamespace } from "../src/clog.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";

Deno.test("basic wrapping with clog", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	moduleLogger.log("hello");

	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes("[app]"));
	assert(consoleOutput.log[0].includes("[module]"));
	assert(consoleOutput.log[0].includes("hello"));

	restoreConsole();
});

Deno.test("callable interface", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	// Direct call should proxy to log
	moduleLogger("called directly");

	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes("[module]"));
	assert(consoleOutput.log[0].includes("called directly"));

	restoreConsole();
});

Deno.test("all log levels work", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	moduleLogger.debug("debug msg");
	moduleLogger.log("log msg");
	moduleLogger.warn("warn msg");
	moduleLogger.error("error msg");

	assertEquals(consoleOutput.debug.length, 1);
	assertEquals(consoleOutput.log.length, 1);
	assertEquals(consoleOutput.warn.length, 1);
	assertEquals(consoleOutput.error.length, 1);

	assert(consoleOutput.debug[0].includes("[module]"));
	assert(consoleOutput.log[0].includes("[module]"));
	assert(consoleOutput.warn[0].includes("[module]"));
	assert(consoleOutput.error[0].includes("[module]"));

	restoreConsole();
});

Deno.test("returns first argument as string", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	assertEquals(moduleLogger.log("hello"), "hello");
	assertEquals(moduleLogger.debug("debug"), "debug");
	assertEquals(moduleLogger.warn(123), "123");
	assertEquals(moduleLogger.error({ msg: "err" }), "[object Object]");
	assertEquals(moduleLogger.log(), "");
	assertEquals(moduleLogger("callable"), "callable");

	restoreConsole();
});

Deno.test("return value works for throw pattern", () => {
	reset();
	const clog = createClog("app");
	const moduleLogger = withNamespace(clog, "module");

	try {
		throw new Error(moduleLogger.error("Something failed"));
		// deno-lint-ignore no-explicit-any
	} catch (e: any) {
		assertEquals(e.message, "Something failed");
	}

	assertEquals(consoleOutput.error.length, 1);
	assert(consoleOutput.error[0].includes("[module]"));
	assert(consoleOutput.error[0].includes("Something failed"));

	restoreConsole();
});

Deno.test("deep nesting", () => {
	reset();
	const clog = createClog("app");
	const level1 = withNamespace(clog, "module");
	const level2 = withNamespace(level1, "sub");
	const level3 = withNamespace(level2, "deep");

	level3.log("deeply nested");

	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes("[app]"));
	assert(consoleOutput.log[0].includes("[module]"));
	assert(consoleOutput.log[0].includes("[sub]"));
	assert(consoleOutput.log[0].includes("[deep]"));
	assert(consoleOutput.log[0].includes("deeply nested"));

	restoreConsole();
});

Deno.test("deep nesting return value pattern", () => {
	reset();
	const clog = createClog("app");
	const level1 = withNamespace(clog, "module");
	const level2 = withNamespace(level1, "sub");

	try {
		throw new Error(level2.error("Deep failure"));
		// deno-lint-ignore no-explicit-any
	} catch (e: any) {
		assertEquals(e.message, "Deep failure");
	}

	restoreConsole();
});

Deno.test("works with native console", () => {
	reset();
	const logger = withNamespace(console, "my-module");

	logger.log("hello from console wrapper");

	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes("[my-module]"));
	assert(consoleOutput.log[0].includes("hello from console wrapper"));

	restoreConsole();
});

Deno.test("preserves parent debug suppression", () => {
	reset();
	const clog = createClog("app", { debug: false });
	const moduleLogger = withNamespace(clog, "module");

	// Parent's debug is suppressed, so wrapped debug should also be suppressed
	moduleLogger.debug("should not appear");

	// Note: the wrapped logger still calls parent.debug, which is a no-op
	assertEquals(consoleOutput.debug.length, 0);

	// Other methods should work
	moduleLogger.log("log works");
	assertEquals(consoleOutput.log.length, 1);

	restoreConsole();
});
