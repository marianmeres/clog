/**
 * Web preset tests for `@marianmeres/clog/web`.
 */

import { assert, assertEquals } from "@std/assert";
import { createClog, type LogData } from "../src/clog.ts";
import {
	configureWebLogger,
	DEFAULT_AGENT_ID_STORAGE_KEY,
	getOrCreateAgentId,
} from "../src/web.ts";
import { reset, restoreConsole } from "./_helpers.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.test("returns forwarder when send is provided", async () => {
	reset();

	const forwarder = configureWebLogger({
		send: async () => {},
		flushIntervalMs: 1000,
	});

	assert(forwarder);
	assertEquals(typeof forwarder.hook, "function");
	assertEquals(typeof forwarder.stop, "function");

	await forwarder.drain();
	restoreConsole();
});

Deno.test("returns undefined in console-only mode (no send)", () => {
	reset();

	const forwarder = configureWebLogger({
		getMeta: () => ({ env: "test" }),
	});

	assertEquals(forwarder, undefined);
	// getMeta should still install
	assertEquals(typeof createClog.global.getMeta, "function");
	assertEquals(createClog.global.getMeta?.(), { env: "test" });

	restoreConsole();
});

Deno.test("wires forwarder.hook into createClog.global.hook", async () => {
	reset();

	const received: LogData[][] = [];
	const forwarder = configureWebLogger({
		send: async (logs) => {
			received.push([...logs]);
		},
		flushIntervalMs: 1000,
	});

	assert(forwarder);
	assertEquals(createClog.global.hook, forwarder.hook);

	const clog = createClog("test");
	clog.log("hello");
	clog.warn("world");

	assertEquals(forwarder.size, 2);

	await forwarder.flush();

	assertEquals(received.length, 1);
	assertEquals(received[0].length, 2);
	assertEquals(received[0][0].args[0], "hello");
	assertEquals(received[0][1].args[0], "world");

	await forwarder.drain();
	restoreConsole();
});

Deno.test("send exceptions mark flush as failed (no crash)", async () => {
	reset();

	let calls = 0;
	const forwarder = configureWebLogger({
		send: async () => {
			calls++;
			throw new Error("network down");
		},
		flushIntervalMs: 1000,
	});

	assert(forwarder);

	createClog("test").log("x");
	assertEquals(forwarder.size, 1);

	const ok = await forwarder.flush();
	assertEquals(ok, false);
	assert(calls >= 1);

	await forwarder.drain();
	restoreConsole();
});

Deno.test("stop halts delivery, start resumes", async () => {
	reset();

	const received: LogData[][] = [];
	const forwarder = configureWebLogger({
		send: async (logs) => {
			received.push([...logs]);
		},
		flushIntervalMs: 1000,
	});

	assert(forwarder);
	forwarder.stop();
	assertEquals(forwarder.isRunning, false);

	createClog("test").log("buffered");
	// Buffer holds the entry; nothing is sent because interval is stopped.
	assertEquals(forwarder.size, 1);
	assertEquals(received.length, 0);

	forwarder.start();
	assert(forwarder.isRunning);

	await forwarder.flush();
	assertEquals(received.length, 1);
	assertEquals(received[0][0].args[0], "buffered");

	await forwarder.drain();
	restoreConsole();
});

Deno.test("getMeta is installed as createClog.global.getMeta", () => {
	reset();

	configureWebLogger({
		getMeta: () => ({ source: "preset", version: 1 }),
	});

	const clog = createClog("test");
	let capturedMeta: Record<string, unknown> | undefined;
	createClog.global.hook = (data) => {
		capturedMeta = data.meta;
	};

	clog.log("hello");

	assertEquals(capturedMeta, { source: "preset", version: 1 });
	restoreConsole();
});

Deno.test("getMeta is omitted when not provided", async () => {
	reset();

	const forwarder = configureWebLogger({ send: async () => {} });

	assertEquals(createClog.global.getMeta, undefined);

	await forwarder?.drain();
	restoreConsole();
});

Deno.test("error handlers are skipped without addEventListener (deno test env)", () => {
	reset();

	// Deno test runtime: globalThis has no `window`/`document` and
	// addEventListener varies; the preset checks for the function and
	// no-ops when absent. We assert configure does not throw and returns
	// an undefined forwarder.
	const forwarder = configureWebLogger({});
	assertEquals(forwarder, undefined);
	restoreConsole();
});

Deno.test("getOrCreateAgentId returns 'n/a' outside browser", () => {
	reset();
	// No window/document in deno test runtime.
	assertEquals(getOrCreateAgentId(), "n/a");
	assertEquals(getOrCreateAgentId({ storageKey: "anything" }), "n/a");
	restoreConsole();
});

Deno.test("getOrCreateAgentId uses configured storageKey (browser mock)", () => {
	reset();

	// Build a minimal browser-shape global so isBrowser() returns true.
	// Deno defines `localStorage` as a non-trivial accessor; use
	// defineProperty to install a plain mock for the duration of the test.
	const store = new Map<string, string>();
	const fakeLocalStorage = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => {
			store.set(k, v);
		},
	};

	// deno-lint-ignore no-explicit-any
	const g = globalThis as any;
	const prevWindow = Object.getOwnPropertyDescriptor(g, "window");
	const prevDocument = Object.getOwnPropertyDescriptor(g, "document");
	const prevLocalStorage = Object.getOwnPropertyDescriptor(g, "localStorage");

	try {
		Object.defineProperty(g, "window", {
			value: g,
			configurable: true,
			writable: true,
		});
		Object.defineProperty(g, "document", {
			value: {},
			configurable: true,
			writable: true,
		});
		Object.defineProperty(g, "localStorage", {
			value: fakeLocalStorage,
			configurable: true,
			writable: true,
		});

		const id1 = getOrCreateAgentId({ storageKey: "custom-key" });
		assert(id1 && id1 !== "n/a");
		assertEquals(store.get("custom-key"), id1);

		// Same key returns same id
		const id2 = getOrCreateAgentId({ storageKey: "custom-key" });
		assertEquals(id1, id2);

		// Default key writes a separate entry
		const idDefault = getOrCreateAgentId();
		assert(idDefault !== id1);
		assertEquals(store.get(DEFAULT_AGENT_ID_STORAGE_KEY), idDefault);
	} finally {
		if (prevWindow) Object.defineProperty(g, "window", prevWindow);
		else delete g.window;
		if (prevDocument) Object.defineProperty(g, "document", prevDocument);
		else delete g.document;
		if (prevLocalStorage) {
			Object.defineProperty(g, "localStorage", prevLocalStorage);
		} else {
			delete g.localStorage;
		}
	}

	restoreConsole();
});
