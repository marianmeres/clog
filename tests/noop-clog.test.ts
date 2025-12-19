/**
 * createNoopClog tests
 */

import { assert, assertEquals } from "@std/assert";
import { createClog, createNoopClog, type LogData } from "../src/clog.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	resetCapturedData,
	restoreConsole,
} from "./_helpers.ts";

Deno.test("returns first argument as string", () => {
	const clog = createNoopClog("test");

	assertEquals(clog.log("hello"), "hello");
	assertEquals(clog.debug("debug"), "debug");
	assertEquals(clog.warn(123), "123");
	assertEquals(clog.error({ msg: "err" }), "[object Object]");
	assertEquals(clog.log(), "");
});

Deno.test("callable interface returns first arg", () => {
	const clog = createNoopClog("test");

	assertEquals(clog("called directly"), "called directly");
	assertEquals(clog(), "");
});

Deno.test("does not call any writer or console", () => {
	reset();
	const clog = createNoopClog("test");

	clog.debug("silent");
	clog.log("silent");
	clog.warn("silent");
	clog.error("silent");
	clog("silent");

	// Nothing should be logged
	assertEquals(consoleOutput.debug.length, 0);
	assertEquals(consoleOutput.log.length, 0);
	assertEquals(consoleOutput.warn.length, 0);
	assertEquals(consoleOutput.error.length, 0);

	restoreConsole();
});

Deno.test("does not trigger global hook", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createNoopClog("test");
	clog.log("should not trigger hook");
	clog.error("should not trigger hook");

	assertEquals(capturedData.length, 0);

	restoreConsole();
});

Deno.test("ns property works", () => {
	const clog1 = createNoopClog("my-namespace");
	assertEquals(clog1.ns, "my-namespace");

	const clog2 = createNoopClog();
	assertEquals(clog2.ns, false);

	const clog3 = createNoopClog(null);
	assertEquals(clog3.ns, false);
});

Deno.test("ns property is readonly", () => {
	const clog = createNoopClog("test");

	try {
		// deno-lint-ignore no-explicit-any
		(clog as any).ns = "changed";
		assert(false, "Should have thrown");
	} catch (_e) {
		assertEquals(clog.ns, "test");
	}
});

Deno.test("return value works for throw pattern", () => {
	const clog = createNoopClog("test");

	try {
		throw new Error(clog.error("Something failed"));
		// deno-lint-ignore no-explicit-any
	} catch (e: any) {
		assertEquals(e.message, "Something failed");
	}
});
