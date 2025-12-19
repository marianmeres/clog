/**
 * Basic clog functionality tests
 */

import { assert, assertEquals, assertMatch } from "@std/assert";
import { createClog, LEVEL_MAP, type LogData } from "../src/clog.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	resetCapturedData,
	restoreConsole,
} from "./_helpers.ts";

Deno.test("callable - proxies to log", () => {
	reset();
	const clog = createClog("test");

	// Direct call should be same as .log()
	const result = clog("hello", "world");

	assertEquals(result, "hello");
	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes("[test]"));
	assert(consoleOutput.log[0].includes("hello"));

	restoreConsole();
});

Deno.test("basic - with namespace", () => {
	reset();
	const clog = createClog("test");

	clog.log("hello", "world");

	assertEquals(clog.ns, "test");
	assertEquals(consoleOutput.log.length, 1);
	assert(consoleOutput.log[0].includes("[test]"));
	assert(consoleOutput.log[0].includes("hello"));
	assert(consoleOutput.log[0].includes("world"));

	restoreConsole();
});

Deno.test("basic - without namespace", () => {
	reset();
	const clog = createClog();

	clog.log("hello", "world");

	assertEquals(clog.ns, false);
	assertEquals(consoleOutput.log.length, 1);
	// In server mode, there will be [timestamp] and [LEVEL] but no [namespace]
	assert(consoleOutput.log[0].includes("hello"));
	assert(consoleOutput.log[0].includes("world"));

	restoreConsole();
});

Deno.test("basic - explicit false namespace", () => {
	reset();
	const clog = createClog(false);

	clog.log("hello");

	assertEquals(clog.ns, false);
	assertEquals(consoleOutput.log.length, 1);

	restoreConsole();
});

Deno.test("all log levels work", () => {
	reset();
	const clog = createClog("test");

	clog.debug("debug msg");
	clog.log("log msg");
	clog.warn("warn msg");
	clog.error("error msg");

	assertEquals(consoleOutput.debug.length, 1);
	assertEquals(consoleOutput.log.length, 1);
	assertEquals(consoleOutput.warn.length, 1);
	assertEquals(consoleOutput.error.length, 1);

	assert(consoleOutput.debug[0].includes("debug msg"));
	assert(consoleOutput.log[0].includes("log msg"));
	assert(consoleOutput.warn[0].includes("warn msg"));
	assert(consoleOutput.error[0].includes("error msg"));

	restoreConsole();
});

Deno.test("returns first argument as string", () => {
	reset();
	const clog = createClog("test");

	assertEquals(clog.log("hello"), "hello");
	assertEquals(clog.debug("debug"), "debug");
	assertEquals(clog.warn(123), "123");
	assertEquals(clog.error({ msg: "err" }), "[object Object]");
	assertEquals(clog.log(), "");

	restoreConsole();
});

Deno.test("return value useful for throw pattern", () => {
	reset();
	const clog = createClog("test");

	try {
		throw new Error(clog.error("Something failed"));
		// deno-lint-ignore no-explicit-any
	} catch (e: any) {
		assertEquals(e.message, "Something failed");
	}

	assertEquals(consoleOutput.error.length, 1);
	assert(consoleOutput.error[0].includes("Something failed"));

	restoreConsole();
});

Deno.test("level mapping is correct", () => {
	assertEquals(LEVEL_MAP.debug, "DEBUG");
	assertEquals(LEVEL_MAP.log, "INFO");
	assertEquals(LEVEL_MAP.warn, "WARNING");
	assertEquals(LEVEL_MAP.error, "ERROR");
});

Deno.test("log data includes timestamp", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createClog("test");
	clog.log("test");

	assertEquals(capturedData.length, 1);
	assert(capturedData[0].timestamp);
	// Check it's ISO format
	assertMatch(capturedData[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);

	restoreConsole();
});

Deno.test("log data includes all arguments", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createClog("test");
	clog.log("msg", 123, { key: "value" }, true);

	assertEquals(capturedData.length, 1);
	assertEquals(capturedData[0].args.length, 4);
	assertEquals(capturedData[0].args[0], "msg");
	assertEquals(capturedData[0].args[1], 123);
	assertEquals(capturedData[0].args[2], { key: "value" });
	assertEquals(capturedData[0].args[3], true);

	restoreConsole();
});

Deno.test("ns property is readonly", () => {
	reset();
	const clog = createClog("test");

	try {
		// deno-lint-ignore no-explicit-any
		(clog as any).ns = "changed";
		assert(false, "Should have thrown");
	} catch (_e) {
		// Expected
		assertEquals(clog.ns, "test");
	}

	restoreConsole();
});

Deno.test("multiple instances with different namespaces", () => {
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

	assertEquals(capturedData.length, 3);
	assertEquals(capturedData[0].namespace, "auth");
	assertEquals(capturedData[1].namespace, "api");
	assertEquals(capturedData[2].namespace, "db");

	restoreConsole();
});

Deno.test("color config sets instance writer", () => {
	reset();

	// Color should only work in browser, but we can test it creates custom writer
	const clog = createClog("test", { color: "red" });
	clog.log("colored");

	// In non-browser environment, should still log
	assertEquals(consoleOutput.log.length, 1);

	restoreConsole();
});
