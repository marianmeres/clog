import { assert, assertEquals, assertMatch } from "@std/assert";
import { createClog, LEVEL_MAP, type LogData } from "../src/clog.ts";

// Test output collectors
let capturedData: LogData[] = [];
let consoleOutput: Record<string, string[]> = {};

// Mock console for testing
const originalConsole = { ...console };

function setupMockConsole() {
	consoleOutput = { debug: [], log: [], warn: [], error: [] };
	["debug", "log", "warn", "error"].forEach((method) => {
		// deno-lint-ignore no-explicit-any
		(console as any)[method] = (...args: any[]) => {
			consoleOutput[method].push(args.join(" "));
		};
	});
}

function restoreConsole() {
	Object.assign(console, originalConsole);
}

function reset() {
	capturedData = [];
	consoleOutput = {};
	createClog.reset();
	setupMockConsole();
}

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

Deno.test("global hook captures all logs", () => {
	reset();
	createClog.global.hook = (data: LogData) => {
		capturedData.push(data);
	};

	const clog1 = createClog("module1");
	const clog2 = createClog("module2");

	clog1.log("msg1");
	clog2.warn("msg2");

	assertEquals(capturedData.length, 2);
	assertEquals(capturedData[0].level, "INFO");
	assertEquals(capturedData[0].namespace, "module1");
	assertEquals(capturedData[0].args[0], "msg1");

	assertEquals(capturedData[1].level, "WARNING");
	assertEquals(capturedData[1].namespace, "module2");
	assertEquals(capturedData[1].args[0], "msg2");

	restoreConsole();
});

Deno.test("global writer overrides default", () => {
	reset();
	const customOutput: string[] = [];

	createClog.global.writer = (data: LogData) => {
		customOutput.push(`${data.level}:${data.namespace}:${data.args[0]}`);
	};

	const clog = createClog("test");
	clog.log("hello");

	assertEquals(consoleOutput.log.length, 0); // default not called
	assertEquals(customOutput.length, 1);
	assertEquals(customOutput[0], "INFO:test:hello");

	restoreConsole();
});

Deno.test("instance writer overrides default", () => {
	reset();
	const customOutput: string[] = [];

	const clog = createClog("test", {
		writer: (data: LogData) => {
			customOutput.push(`${data.level}:${data.args[0]}`);
		},
	});

	clog.warn("warning");

	assertEquals(consoleOutput.warn.length, 0); // default not called
	assertEquals(customOutput.length, 1);
	assertEquals(customOutput[0], "WARNING:warning");

	restoreConsole();
});

Deno.test("global writer takes precedence over instance writer", () => {
	reset();
	const globalOutput: string[] = [];
	const instanceOutput: string[] = [];

	createClog.global.writer = (_data: LogData) => {
		globalOutput.push("global");
	};

	const clog = createClog("test", {
		writer: (_data: LogData) => {
			instanceOutput.push("instance");
		},
	});

	clog.log("test");

	assertEquals(globalOutput.length, 1);
	assertEquals(instanceOutput.length, 0); // instance writer not called

	restoreConsole();
});

Deno.test("hook is called before writer", () => {
	reset();
	const callOrder: string[] = [];

	createClog.global.hook = () => {
		callOrder.push("hook");
	};

	const clog = createClog("test", {
		writer: () => {
			callOrder.push("writer");
		},
	});

	clog.log("test");

	assertEquals(callOrder, ["hook", "writer"]);

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
	createClog.global.hook = (data: LogData) => {
		capturedData.push(data);
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
	createClog.global.hook = (data: LogData) => {
		capturedData.push(data);
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

Deno.test("reset() clears global configuration", () => {
	createClog.global.hook = () => {};
	createClog.global.writer = () => {};
	createClog.global.jsonOutput = true;

	createClog.reset();

	assertEquals(createClog.global.hook, undefined);
	assertEquals(createClog.global.writer, undefined);
	assertEquals(createClog.global.jsonOutput, false);
});

Deno.test("multiple instances with different namespaces", () => {
	reset();
	createClog.global.hook = (data: LogData) => {
		capturedData.push(data);
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

Deno.test("batching pattern example", () => {
	reset();
	const batch: LogData[] = [];

	// Setup batching hook
	createClog.global.hook = (data: LogData) => {
		batch.push(data);
		if (batch.length >= 3) {
			// Flush batch
			const _copy = [...batch];
			batch.length = 0;
			// In real scenario, would send to server/file
		}
	};

	const clog = createClog("app");
	clog.log("msg1");
	clog.log("msg2");
	assertEquals(batch.length, 2);

	clog.log("msg3"); // triggers flush
	assertEquals(batch.length, 0); // batch was flushed

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
