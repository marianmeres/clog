/**
 * Basic clog functionality tests
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createClog, LEVEL_MAP, type LogData } from "../src/clog.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	resetCapturedData,
	restoreConsole,
} from "./_helpers.ts";

test("callable - proxies to log", () => {
	reset();
	const clog = createClog("test");

	// Direct call should be same as .log()
	const result = clog("hello", "world");

	assert.deepEqual(result, "hello");
	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes("[test]"));
	assert(consoleOutput.log[0]!.includes("hello"));

	restoreConsole();
});

test("basic - with namespace", () => {
	reset();
	const clog = createClog("test");

	clog.log("hello", "world");

	assert.deepEqual(clog.ns, "test");
	assert.deepEqual(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0]!.includes("[test]"));
	assert(consoleOutput.log[0]!.includes("hello"));
	assert(consoleOutput.log[0]!.includes("world"));

	restoreConsole();
});

test("basic - without namespace", () => {
	reset();
	const clog = createClog();

	clog.log("hello", "world");

	assert.deepEqual(clog.ns, false);
	assert.deepEqual(consoleOutput.log.length, 1);
	// In server mode, there will be [timestamp] and [LEVEL] but no [namespace]
	assert(consoleOutput.log[0]!.includes("hello"));
	assert(consoleOutput.log[0]!.includes("world"));

	restoreConsole();
});

test("basic - explicit false namespace", () => {
	reset();
	const clog = createClog(false);

	clog.log("hello");

	assert.deepEqual(clog.ns, false);
	assert.deepEqual(consoleOutput.log.length, 1);

	restoreConsole();
});

test("all log levels work", () => {
	reset();
	const clog = createClog("test");

	clog.debug("debug msg");
	clog.log("log msg");
	clog.warn("warn msg");
	clog.error("error msg");

	assert.deepEqual(consoleOutput.debug.length, 1);
	assert.deepEqual(consoleOutput.log.length, 1);
	assert.deepEqual(consoleOutput.warn.length, 1);
	assert.deepEqual(consoleOutput.error.length, 1);

	assert(consoleOutput.debug[0]!.includes("debug msg"));
	assert(consoleOutput.log[0]!.includes("log msg"));
	assert(consoleOutput.warn[0]!.includes("warn msg"));
	assert(consoleOutput.error[0]!.includes("error msg"));

	restoreConsole();
});

test("returns first argument as string", () => {
	reset();
	const clog = createClog("test");

	assert.deepEqual(clog.log("hello"), "hello");
	assert.deepEqual(clog.debug("debug"), "debug");
	assert.deepEqual(clog.warn(123), "123");
	assert.deepEqual(clog.error({ msg: "err" }), "[object Object]");
	assert.deepEqual(clog.log(), "");

	restoreConsole();
});

test("return value useful for throw pattern", () => {
	reset();
	const clog = createClog("test");

	try {
		throw new Error(clog.error("Something failed"));
		// biome-ignore lint/suspicious/noExplicitAny: reads e.message
	} catch (e: any) {
		assert.deepEqual(e.message, "Something failed");
	}

	assert.deepEqual(consoleOutput.error.length, 1);
	assert(consoleOutput.error[0]!.includes("Something failed"));

	restoreConsole();
});

test("level mapping is correct", () => {
	assert.deepEqual(LEVEL_MAP.debug, "DEBUG");
	assert.deepEqual(LEVEL_MAP.log, "INFO");
	assert.deepEqual(LEVEL_MAP.warn, "WARNING");
	assert.deepEqual(LEVEL_MAP.error, "ERROR");
});

test("log data includes timestamp", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createClog("test");
	clog.log("test");

	assert.deepEqual(capturedData.length, 1);
	assert(capturedData[0]!.timestamp);
	// Check it's ISO format
	assert.match(capturedData[0]!.timestamp, /^\d{4}-\d{2}-\d{2}T/);

	restoreConsole();
});

test("log data includes all arguments", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createClog("test");
	clog.log("msg", 123, { key: "value" }, true);

	assert.deepEqual(capturedData.length, 1);
	assert.deepEqual(capturedData[0]!.args.length, 4);
	assert.deepEqual(capturedData[0]!.args[0], "msg");
	assert.deepEqual(capturedData[0]!.args[1], 123);
	assert.deepEqual(capturedData[0]!.args[2], { key: "value" });
	assert.deepEqual(capturedData[0]!.args[3], true);

	restoreConsole();
});

test("ns property is readonly", () => {
	reset();
	const clog = createClog("test");

	try {
		// biome-ignore lint/suspicious/noExplicitAny: writes the read-only `ns` on purpose
		(clog as any).ns = "changed";
		assert(false, "Should have thrown");
	} catch (_e) {
		// Expected
		assert.deepEqual(clog.ns, "test");
	}

	restoreConsole();
});

test("multiple instances with different namespaces", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const auth = createClog("auth");
	const api = createClog("api");
	const db = createClog("db");

	auth.log("user login");
	api.warn("slow request");
	db.error("connection failed");

	assert.deepEqual(capturedData.length, 3);
	assert.deepEqual(capturedData[0]!.namespace, "auth");
	assert.deepEqual(capturedData[1]!.namespace, "api");
	assert.deepEqual(capturedData[2]!.namespace, "db");

	restoreConsole();
});

test("color config sets instance writer", () => {
	reset();

	// Color should only work in browser, but we can test it creates custom writer
	const clog = createClog("test", { color: "red" });
	clog.log("colored");

	// In non-browser environment, should still log
	assert.deepEqual(consoleOutput.log.length, 1);

	restoreConsole();
});
