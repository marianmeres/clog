/**
 * getMeta functionality tests
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

test("instance config provides metadata to hook", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};

	const clog = createClog("test", {
		getMeta: () => ({ userId: "user-123", requestId: "req-456" }),
	});

	clog.log("hello");

	assert.deepEqual(capturedData.length, 1);
	assert.deepEqual(capturedData[0]!.meta, { userId: "user-123", requestId: "req-456" });

	restoreConsole();
});

test("global config provides metadata to hook", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};
	createClog.global.getMeta = () => ({ sessionId: "sess-789" });

	const clog = createClog("test");
	clog.log("hello");

	assert.deepEqual(capturedData.length, 1);
	assert.deepEqual(capturedData[0]!.meta, { sessionId: "sess-789" });

	restoreConsole();
});

test("instance overrides global", () => {
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

	assert.deepEqual(capturedData.length, 1);
	assert.deepEqual(capturedData[0]!.meta, { source: "instance" });

	restoreConsole();
});

test("metadata available in custom writer", () => {
	reset();
	let capturedMeta: Record<string, unknown> | undefined;

	const clog = createClog("test", {
		getMeta: () => ({ traceId: "trace-001" }),
		writer: (data: LogData) => {
			capturedMeta = data.meta;
		},
	});

	clog.log("hello");

	assert.deepEqual(capturedMeta, { traceId: "trace-001" });

	restoreConsole();
});

test("metadata included in JSON output", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ userId: "user-abc", env: "test" });

	const clog = createClog("api");
	clog.log("Request received");

	assert.deepEqual(consoleOutput.log.length, 1);

	const output = JSON.parse(consoleOutput.log[0]!);
	assert.deepEqual(output.meta, { userId: "user-abc", env: "test" });
	assert.deepEqual(output.message, "Request received");

	restoreConsole();
});

test("undefined meta not included in JSON output", () => {
	reset();
	createClog.global.jsonOutput = true;
	// No getMeta configured

	const clog = createClog("test");
	clog.log("no meta");

	assert.deepEqual(consoleOutput.log.length, 1);

	const output = JSON.parse(consoleOutput.log[0]!);
	assert(!("meta" in output), "meta field should not be present when undefined");

	restoreConsole();
});

test("called on each log", () => {
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

	assert.deepEqual(capturedData.length, 3);
	assert.deepEqual(capturedData[0]!.meta, { callCount: 1 });
	assert.deepEqual(capturedData[1]!.meta, { callCount: 2 });
	assert.deepEqual(capturedData[2]!.meta, { callCount: 3 });

	restoreConsole();
});

test("works with all log levels", () => {
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

	assert.deepEqual(capturedData.length, 4);
	capturedData.forEach((data) => {
		assert.deepEqual(data.meta, { userId: "test-user" });
	});

	restoreConsole();
});

test("reset() clears global getMeta", () => {
	createClog.global.getMeta = () => ({ test: true });

	createClog.reset();

	assert.deepEqual(createClog.global.getMeta, undefined);
});
