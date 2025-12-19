/**
 * getMeta functionality tests
 */

import { assert, assertEquals } from "@std/assert";
import { createClog, type LogData } from "../src/clog.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	resetCapturedData,
	restoreConsole,
} from "./_helpers.ts";

Deno.test("instance config provides metadata to hook", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createClog("test", {
		getMeta: () => ({ userId: "user-123", requestId: "req-456" }),
	});

	clog.log("hello");

	assertEquals(capturedData.length, 1);
	assertEquals(capturedData[0].meta, { userId: "user-123", requestId: "req-456" });

	restoreConsole();
});

Deno.test("global config provides metadata to hook", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};
	createClog.global.getMeta = () => ({ sessionId: "sess-789" });

	const clog = createClog("test");
	clog.log("hello");

	assertEquals(capturedData.length, 1);
	assertEquals(capturedData[0].meta, { sessionId: "sess-789" });

	restoreConsole();
});

Deno.test("instance overrides global", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};
	createClog.global.getMeta = () => ({ source: "global" });

	const clog = createClog("test", {
		getMeta: () => ({ source: "instance" }),
	});

	clog.log("hello");

	assertEquals(capturedData.length, 1);
	assertEquals(capturedData[0].meta, { source: "instance" });

	restoreConsole();
});

Deno.test("metadata available in custom writer", () => {
	reset();
	let capturedMeta: Record<string, unknown> | undefined;

	const clog = createClog("test", {
		getMeta: () => ({ traceId: "trace-001" }),
		writer: (data: LogData) => {
			capturedMeta = data.meta;
		},
	});

	clog.log("hello");

	assertEquals(capturedMeta, { traceId: "trace-001" });

	restoreConsole();
});

Deno.test("metadata included in JSON output", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ userId: "user-abc", env: "test" });

	const clog = createClog("api");
	clog.log("Request received");

	assertEquals(consoleOutput.log.length, 1);

	const output = JSON.parse(consoleOutput.log[0]);
	assertEquals(output.meta, { userId: "user-abc", env: "test" });
	assertEquals(output.message, "Request received");

	restoreConsole();
});

Deno.test("undefined meta not included in JSON output", () => {
	reset();
	createClog.global.jsonOutput = true;
	// No getMeta configured

	const clog = createClog("test");
	clog.log("no meta");

	assertEquals(consoleOutput.log.length, 1);

	const output = JSON.parse(consoleOutput.log[0]);
	assert(!("meta" in output), "meta field should not be present when undefined");

	restoreConsole();
});

Deno.test("called on each log", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	let counter = 0;
	const clog = createClog("test", {
		getMeta: () => ({ callCount: ++counter }),
	});

	clog.log("first");
	clog.log("second");
	clog.log("third");

	assertEquals(capturedData.length, 3);
	assertEquals(capturedData[0].meta, { callCount: 1 });
	assertEquals(capturedData[1].meta, { callCount: 2 });
	assertEquals(capturedData[2].meta, { callCount: 3 });

	restoreConsole();
});

Deno.test("works with all log levels", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createClog("test", {
		getMeta: () => ({ userId: "test-user" }),
	});

	clog.debug("debug");
	clog.log("log");
	clog.warn("warn");
	clog.error("error");

	assertEquals(capturedData.length, 4);
	capturedData.forEach((data) => {
		assertEquals(data.meta, { userId: "test-user" });
	});

	restoreConsole();
});

Deno.test("reset() clears global getMeta", () => {
	createClog.global.getMeta = () => ({ test: true });

	createClog.reset();

	assertEquals(createClog.global.getMeta, undefined);
});
