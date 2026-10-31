/**
 * Debug mode tests
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createClog, type LogData } from "../src/clog.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	resetCapturedData,
	restoreConsole,
} from "./_helpers.ts";

test("debug config option suppresses .debug() output", () => {
	reset();

	const clog = createClog("test", { debug: false });

	// .debug() should be no-op
	const result = clog.debug("should not appear");
	assert.deepEqual(consoleOutput.debug.length, 0);

	// But should still return first arg as string
	assert.deepEqual(result, "should not appear");

	// Other methods should work normally
	clog.log("log works");
	clog.warn("warn works");
	clog.error("error works");

	assert.deepEqual(consoleOutput.log.length, 1);
	assert.deepEqual(consoleOutput.warn.length, 1);
	assert.deepEqual(consoleOutput.error.length, 1);

	restoreConsole();
});

test("debug config defaults to enabled", () => {
	reset();

	// Without debug option
	const clog1 = createClog("test1");
	clog1.debug("debug enabled by default");
	assert.deepEqual(consoleOutput.debug.length, 1);

	// With debug: true
	const clog2 = createClog("test2", { debug: true });
	clog2.debug("debug explicitly enabled");
	assert.deepEqual(consoleOutput.debug.length, 2);

	restoreConsole();
});

test("debug: false does not call hook for .debug()", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createClog("test", { debug: false });

	clog.debug("skipped");
	clog.log("captured");

	// Only .log() should have triggered the hook
	assert.deepEqual(capturedData.length, 1);
	assert.deepEqual(capturedData[0]!.level, "INFO");

	restoreConsole();
});

test("global debug: false suppresses .debug() output", () => {
	reset();
	createClog.global.debug = false;

	const clog = createClog("test");

	const result = clog.debug("should not appear");
	assert.deepEqual(consoleOutput.debug.length, 0);
	assert.deepEqual(result, "should not appear");

	// Other methods should work normally
	clog.log("log works");
	assert.deepEqual(consoleOutput.log.length, 1);

	restoreConsole();
});

test("instance debug: true overrides global debug: false", () => {
	reset();
	createClog.global.debug = false;

	const clog = createClog("test", { debug: true });

	clog.debug("should appear");
	assert.deepEqual(consoleOutput.debug.length, 1);

	restoreConsole();
});

test("instance debug: false overrides global debug: true", () => {
	reset();
	createClog.global.debug = true;

	const clog = createClog("test", { debug: false });

	clog.debug("should not appear");
	assert.deepEqual(consoleOutput.debug.length, 0);

	restoreConsole();
});

test("reset() clears global debug", () => {
	createClog.global.debug = false;

	createClog.reset();

	assert.deepEqual(createClog.global.debug, undefined);
});
