/**
 * config.meta (per-logger meta merged over the base getMeta) and withMeta tests
 */

import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import {
	createClog,
	createNoopClog,
	type LogData,
	withMeta,
	withNamespace,
} from "../src/clog.ts";
import {
	capturedData,
	consoleOutput,
	pushCapturedData,
	reset,
	restoreConsole,
} from "./_helpers.ts";

function captureHook() {
	createClog.global.hook = (data: LogData) => {
		pushCapturedData(data);
	};
}

// --- config.meta ---------------------------------------------------------

Deno.test("meta is merged over the global getMeta and wins on conflicts", () => {
	reset();
	captureHook();
	createClog.global.getMeta = () => ({ projectId: "p1", source: "global" });

	const clog = createClog("test", { meta: { traceId: "t1", source: "instance" } });
	clog.log("hello");

	assertEquals(capturedData[0].meta, {
		projectId: "p1",
		source: "instance",
		traceId: "t1",
	});

	restoreConsole();
});

Deno.test("meta is merged over an instance getMeta (which replaces the global)", () => {
	reset();
	captureHook();
	createClog.global.getMeta = () => ({ fromGlobal: true });

	const clog = createClog("test", {
		getMeta: () => ({ fromInstance: true, source: "getMeta" }),
		meta: () => ({ traceId: "t1", source: "meta" }),
	});
	clog.log("hello");

	assertEquals(capturedData[0].meta, {
		fromInstance: true,
		source: "meta",
		traceId: "t1",
	});

	restoreConsole();
});

Deno.test("a global getMeta installed after the logger was created still applies", () => {
	reset();
	captureHook();

	const clog = createClog("test", { meta: { traceId: "t1" } });
	clog.log("before");
	createClog.global.getMeta = () => ({ projectId: "p1" });
	clog.log("after");

	assertEquals(capturedData[0].meta, { traceId: "t1" });
	assertEquals(capturedData[1].meta, { projectId: "p1", traceId: "t1" });

	restoreConsole();
});

Deno.test("meta works without any getMeta (instance or global)", () => {
	reset();
	captureHook();

	createClog("test", { meta: { traceId: "t1" } }).log("static");
	createClog("test", { meta: () => ({ traceId: "t2" }) }).log("fn");

	assertEquals(capturedData[0].meta, { traceId: "t1" });
	assertEquals(capturedData[1].meta, { traceId: "t2" });

	restoreConsole();
});

Deno.test("function meta is not called when no consumer reads .meta", () => {
	reset();
	let calls = 0;

	const clog = createClog("test", {
		meta: () => {
			calls++;
			return { traceId: "t1" };
		},
	});
	clog.log("plain text writer does not read meta");

	assertEquals(calls, 0);

	restoreConsole();
});

Deno.test("function meta is called once per line when .meta is read", () => {
	reset();
	let calls = 0;
	createClog.global.hook = (data: LogData) => {
		void data.meta;
		void data.meta;
		void data.meta;
	};

	const clog = createClog("test", {
		meta: () => ({ call: ++calls }),
	});
	clog.log("first");
	clog.log("second");

	assertEquals(calls, 2);

	restoreConsole();
});

Deno.test("a hook mutating data.meta does not mutate a static meta object", () => {
	reset();
	createClog.global.hook = (data: LogData) => {
		data.meta!.traceId = "mutated";
		data.meta!.extra = true;
	};

	const meta = { traceId: "t1" };
	createClog("test", { meta }).log("hello");

	assertEquals(meta, { traceId: "t1" });

	restoreConsole();
});

Deno.test("a static meta object is read per line (later changes apply)", () => {
	reset();
	// Read .meta inside the hook: it is lazy, so reading it later would see
	// the object's state at read time, not at log time.
	const seen: unknown[] = [];
	createClog.global.hook = (data: LogData) => {
		seen.push(data.meta);
	};

	const meta: Record<string, unknown> = { traceId: "t1" };
	const clog = createClog("test", { meta });
	clog.log("first");
	meta.traceId = "t2";
	clog.log("second");

	assertEquals(seen, [{ traceId: "t1" }, { traceId: "t2" }]);

	restoreConsole();
});

Deno.test("throwing base getMeta: meta is still present", () => {
	reset();
	captureHook();
	createClog.global.getMeta = () => {
		throw new Error("base boom");
	};

	createClog("test", { meta: { traceId: "t1" } }).log("hello");

	assertEquals(capturedData[0].meta, { traceId: "t1" });

	restoreConsole();
});

Deno.test("throwing function meta: the base is still present", () => {
	reset();
	captureHook();
	createClog.global.getMeta = () => ({ projectId: "p1" });

	createClog("test", {
		meta: () => {
			throw new Error("meta boom");
		},
	}).log("hello");

	assertEquals(capturedData[0].meta, { projectId: "p1" });

	restoreConsole();
});

Deno.test("both sources throwing: meta is undefined", () => {
	reset();
	captureHook();

	createClog("test", {
		getMeta: () => {
			throw new Error("base boom");
		},
		meta: () => {
			throw new Error("meta boom");
		},
	}).log("hello");

	assertEquals(capturedData[0].meta, undefined);

	restoreConsole();
});

Deno.test("both sources returning undefined: meta is undefined", () => {
	reset();
	captureHook();

	createClog("test", {
		// deno-lint-ignore no-explicit-any
		getMeta: () => undefined as any,
		// deno-lint-ignore no-explicit-any
		meta: () => undefined as any,
	}).log("hello");

	assertEquals(capturedData[0].meta, undefined);

	restoreConsole();
});

Deno.test("withNamespace child inherits meta", () => {
	reset();
	captureHook();
	createClog.global.getMeta = () => ({ projectId: "p1" });

	const child = withNamespace(createClog("a", { meta: { traceId: "t1" } }), "b");
	child.log("hello");

	assertEquals(child.ns, "a:b");
	assertEquals(capturedData[0].meta, { projectId: "p1", traceId: "t1" });

	restoreConsole();
});

Deno.test("JSON output puts the merged meta under the meta field", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ projectId: "p1" });

	createClog("api", { meta: { traceId: "t1" } }).log("hello");

	const output = JSON.parse(consoleOutput.log[0]);
	assertEquals(output.meta, { projectId: "p1", traceId: "t1" });

	restoreConsole();
});

Deno.test("JSON output respects jsonFieldNames for the merged meta", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => ({ projectId: "p1" });

	createClog("api", {
		meta: { traceId: "t1" },
		jsonFieldNames: { meta: "context" },
	}).log("hello");

	const output = JSON.parse(consoleOutput.log[0]);
	assert(!("meta" in output));
	assertEquals(output.context, { projectId: "p1", traceId: "t1" });

	restoreConsole();
});

Deno.test("JSON output omits meta when every source throws", () => {
	reset();
	createClog.global.jsonOutput = true;
	createClog.global.getMeta = () => {
		throw new Error("base boom");
	};

	createClog("api", {
		meta: () => {
			throw new Error("meta boom");
		},
	}).log("hello");

	const output = JSON.parse(consoleOutput.log[0]);
	assert(!("meta" in output));

	restoreConsole();
});

// --- withMeta ------------------------------------------------------------

Deno.test("withMeta keeps the namespace and adds meta over the base", () => {
	reset();
	captureHook();
	createClog.global.getMeta = () => ({ projectId: "p1" });

	const reqLog = withMeta(createClog("api"), { requestId: "r1" });
	reqLog.log("hello");

	assertEquals(reqLog.ns, "api");
	assertEquals(capturedData[0].namespace, "api");
	assertEquals(capturedData[0].meta, { projectId: "p1", requestId: "r1" });

	restoreConsole();
});

Deno.test("nested withMeta keeps both layers, inner layer wins", () => {
	reset();
	captureHook();

	const log = createClog("api", { meta: { layer: "config", service: "s1" } });
	const reqLog = withMeta(log, { layer: "req", requestId: "r1" });
	let attempt = 0;
	const callLog = withMeta(reqLog, () => ({ layer: "call", attempt: ++attempt }));
	callLog.log("hello");

	assertEquals(capturedData[0].meta, {
		layer: "call",
		service: "s1",
		requestId: "r1",
		attempt: 1,
	});

	restoreConsole();
});

Deno.test("withMeta does not change the parent logger", () => {
	reset();
	captureHook();

	const log = createClog("api", { meta: { service: "s1" } });
	withMeta(log, { requestId: "r1" });
	log.log("parent");

	assertEquals(capturedData[0].meta, { service: "s1" });

	restoreConsole();
});

Deno.test("withMeta layers are isolated: a throwing layer drops only itself", () => {
	reset();
	captureHook();

	const log = createClog("api", {
		meta: () => {
			throw new Error("parent boom");
		},
	});
	const child = withMeta(log, { requestId: "r1" });
	const grandchild = withMeta(child, () => {
		throw new Error("child boom");
	});
	child.log("child");
	grandchild.log("grandchild");

	assertEquals(capturedData[0].meta, { requestId: "r1" });
	assertEquals(capturedData[1].meta, { requestId: "r1" });

	restoreConsole();
});

Deno.test("withMeta keeps the parent's other config (getMeta, debug)", () => {
	reset();
	captureHook();

	const log = createClog("api", {
		getMeta: () => ({ fromGetMeta: true }),
		debug: false,
	});
	const child = withMeta(log, { requestId: "r1" });
	child.debug("suppressed");
	child.log("hello");

	assertEquals(capturedData.length, 1);
	assertEquals(capturedData[0].meta, { fromGetMeta: true, requestId: "r1" });

	restoreConsole();
});

Deno.test("withNamespace over withMeta keeps the layered meta", () => {
	reset();
	captureHook();

	const child = withNamespace(withMeta(createClog("api"), { requestId: "r1" }), "db");
	child.log("hello");

	assertEquals(child.ns, "api:db");
	assertEquals(capturedData[0].meta, { requestId: "r1" });

	restoreConsole();
});

Deno.test("withMeta returns non-clog loggers unchanged", () => {
	const noop = createNoopClog("x");
	assertStrictEquals(withMeta(console, { requestId: "r1" }), console);
	assertStrictEquals(withMeta(noop, { requestId: "r1" }), noop);
});
