/**
 * createNoopClog tests
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createClog, createNoopClog, type LogData } from "../src/clog.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	resetCapturedData,
	restoreConsole,
} from "./_helpers.ts";

test("returns first argument as string", () => {
	const clog = createNoopClog("test");

	assert.deepEqual(clog.log("hello"), "hello");
	assert.deepEqual(clog.debug("debug"), "debug");
	assert.deepEqual(clog.warn(123), "123");
	assert.deepEqual(clog.error({ msg: "err" }), "[object Object]");
	assert.deepEqual(clog.log(), "");
});

test("callable interface returns first arg", () => {
	const clog = createNoopClog("test");

	assert.deepEqual(clog("called directly"), "called directly");
	assert.deepEqual(clog(), "");
});

test("does not call any writer or console", () => {
	reset();
	const clog = createNoopClog("test");

	clog.debug("silent");
	clog.log("silent");
	clog.warn("silent");
	clog.error("silent");
	clog("silent");

	// Nothing should be logged
	assert.deepEqual(consoleOutput.debug.length, 0);
	assert.deepEqual(consoleOutput.log.length, 0);
	assert.deepEqual(consoleOutput.warn.length, 0);
	assert.deepEqual(consoleOutput.error.length, 0);

	restoreConsole();
});

test("does not trigger global hook", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createNoopClog("test");
	clog.log("should not trigger hook");
	clog.error("should not trigger hook");

	assert.deepEqual(capturedData.length, 0);

	restoreConsole();
});

test("ns property works", () => {
	const clog1 = createNoopClog("my-namespace");
	assert.deepEqual(clog1.ns, "my-namespace");

	const clog2 = createNoopClog();
	assert.deepEqual(clog2.ns, false);

	const clog3 = createNoopClog(null);
	assert.deepEqual(clog3.ns, false);
});

test("ns property is readonly", () => {
	const clog = createNoopClog("test");

	try {
		// biome-ignore lint/suspicious/noExplicitAny: writes the read-only `ns` on purpose
		(clog as any).ns = "changed";
		assert(false, "Should have thrown");
	} catch (_e) {
		assert.deepEqual(clog.ns, "test");
	}
});

test("return value works for throw pattern", () => {
	const clog = createNoopClog("test");

	try {
		throw new Error(clog.error("Something failed"));
		// biome-ignore lint/suspicious/noExplicitAny: reads e.message
	} catch (e: any) {
		assert.deepEqual(e.message, "Something failed");
	}
});
