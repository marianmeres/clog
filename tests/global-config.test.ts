/**
 * Global configuration tests (hook, writer, reset)
 */

import { assert, assertEquals } from "@std/assert";
import { CLOG_SKIP, createClog, type LogData } from "../src/clog.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	resetCapturedData,
	restoreConsole,
} from "./_helpers.ts";

Deno.test("global hook captures all logs", () => {
	reset();
	resetCapturedData();
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
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

Deno.test("reset() clears global configuration", () => {
	createClog.global.hook = () => {};
	createClog.global.writer = () => {};
	createClog.global.jsonOutput = true;

	createClog.reset();

	assertEquals(createClog.global.hook, undefined);
	assertEquals(createClog.global.writer, undefined);
	assertEquals(createClog.global.jsonOutput, false);
});

Deno.test("hook mutation: namespace prefix propagates to default text writer", () => {
	reset();

	createClog.global.hook = (data: LogData) => {
		if (data.namespace) data.namespace = `svc:${data.namespace}`;
	};

	const clog = createClog("api");
	clog.log("hello");

	assertEquals(consoleOutput.log.length, 1);
	// Composed namespace renders as "[svc] [api]" in text output.
	assert(consoleOutput.log[0].includes("[svc] [api]"));

	restoreConsole();
});

Deno.test("hook mutation: namespace prefix propagates to JSON 'logger' field", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.hook = (data: LogData) => {
		if (data.namespace) data.namespace = `svc:${data.namespace}`;
	};

	const clog = createClog("api");
	clog.log("hello");

	assertEquals(consoleOutput.log.length, 1);
	const output = JSON.parse(consoleOutput.log[0]);
	assertEquals(output.logger, "svc:api");

	restoreConsole();
});

Deno.test("hook mutation: data.args replacement reaches the writer without touching caller's array", () => {
	reset();
	const seenByWriter: unknown[][] = [];
	createClog.global.writer = (data: LogData) => {
		seenByWriter.push(data.args);
	};
	createClog.global.hook = (data: LogData) => {
		data.args = data.args.map((a) =>
			typeof a === "string" ? a.replace(/token=\S+/g, "token=***") : a,
		);
	};

	const clog = createClog("api");
	const callerArgs = ["request token=secret123", { id: 1 }];
	clog.log(...callerArgs);

	assertEquals(seenByWriter.length, 1);
	assertEquals(seenByWriter[0][0], "request token=***");
	assertEquals(seenByWriter[0][1], { id: 1 });
	// Caller's array was not mutated by either the clone (existing guarantee)
	// or the hook's replacement (replacement targets data.args, a clone).
	assertEquals(callerArgs[0], "request token=secret123");

	restoreConsole();
});

Deno.test("hook mutation: meta augmentation surfaces in writer", () => {
	reset();
	const seen: Array<Record<string, unknown> | undefined> = [];
	createClog.global.writer = (data: LogData) => {
		seen.push(data.meta);
	};
	createClog.global.hook = (data: LogData) => {
		// Hook can supply meta even when no getMeta is configured.
		(data as { meta?: Record<string, unknown> }).meta = { traceId: "abc" };
	};

	const clog = createClog("api");
	clog.log("ping");

	assertEquals(seen.length, 1);
	assertEquals(seen[0], { traceId: "abc" });

	restoreConsole();
});

Deno.test("hook mutation: transform combined with CLOG_SKIP suppresses writer (mutation has no observable effect)", () => {
	reset();
	const seenByWriter: LogData[] = [];
	createClog.global.writer = (data: LogData) => {
		seenByWriter.push(data);
	};
	createClog.global.hook = (data: LogData) => {
		data.namespace = "mutated";
		return CLOG_SKIP;
	};

	const clog = createClog("api");
	clog.log("hello");

	assertEquals(seenByWriter.length, 0); // writer never ran

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
