/**
 * Web preset tests for `@marianmeres/clog/web`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createClog, type LogData } from "../src/clog.ts";
import {
	configureWebLogger,
	DEFAULT_AGENT_ID_STORAGE_KEY,
	getOrCreateAgentId,
} from "../src/web.ts";
import { consoleOutput, reset, restoreConsole } from "./_helpers.ts";

test("returns forwarder when send is provided", async () => {
	reset();

	const forwarder = configureWebLogger({
		send: async () => {},
		flushIntervalMs: 1000,
	});

	assert(forwarder);
	assert.deepEqual(typeof forwarder.hook, "function");
	assert.deepEqual(typeof forwarder.stop, "function");

	await forwarder.drain();
	restoreConsole();
});

test("returns undefined in console-only mode (no send)", () => {
	reset();

	const forwarder = configureWebLogger({
		getMeta: () => ({ env: "test" }),
	});

	assert.deepEqual(forwarder, undefined);
	// getMeta should still install
	assert.deepEqual(typeof createClog.global.getMeta, "function");
	assert.deepEqual(createClog.global.getMeta?.(), { env: "test" });

	restoreConsole();
});

test("wires forwarder.hook into createClog.global.hook", async () => {
	reset();

	const received: LogData[][] = [];
	const forwarder = configureWebLogger({
		send: async (logs) => {
			received.push([...logs]);
		},
		flushIntervalMs: 1000,
	});

	assert(forwarder);
	assert.deepEqual(createClog.global.hook, forwarder.hook);

	const clog = createClog("test");
	clog.log("hello");
	clog.warn("world");

	assert.deepEqual(forwarder.size, 2);

	await forwarder.flush();

	assert.deepEqual(received.length, 1);
	assert.deepEqual(received[0]!.length, 2);
	assert.deepEqual(received[0]![0]!.args[0], "hello");
	assert.deepEqual(received[0]![1]!.args[0], "world");

	await forwarder.drain();
	restoreConsole();
});

test("send exceptions mark flush as failed (no crash)", async () => {
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
	assert.deepEqual(forwarder.size, 1);

	const ok = await forwarder.flush();
	assert.deepEqual(ok, false);
	assert(calls >= 1);

	await forwarder.drain();
	restoreConsole();
});

test("stop halts delivery, start resumes", async () => {
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
	assert.deepEqual(forwarder.isRunning, false);

	createClog("test").log("buffered");
	// Buffer holds the entry; nothing is sent because interval is stopped.
	assert.deepEqual(forwarder.size, 1);
	assert.deepEqual(received.length, 0);

	forwarder.start();
	assert(forwarder.isRunning);

	await forwarder.flush();
	assert.deepEqual(received.length, 1);
	assert.deepEqual(received[0]![0]!.args[0], "buffered");

	await forwarder.drain();
	restoreConsole();
});

test("getMeta is installed as createClog.global.getMeta", () => {
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

	assert.deepEqual(capturedMeta, { source: "preset", version: 1 });
	restoreConsole();
});

test("getMeta is omitted when not provided", async () => {
	reset();

	const forwarder = configureWebLogger({ send: async () => {} });

	assert.deepEqual(createClog.global.getMeta, undefined);

	await forwarder?.drain();
	restoreConsole();
});

test("error handlers are skipped without addEventListener (server env)", () => {
	reset();

	// Server test runtime: globalThis has no `window`/`document` and
	// addEventListener varies (Deno has it, Node does not); the preset checks
	// for the function and no-ops when absent. We assert configure does not
	// throw and returns an undefined forwarder.
	const forwarder = configureWebLogger({});
	assert.deepEqual(forwarder, undefined);
	restoreConsole();
});

test("getOrCreateAgentId returns 'n/a' outside browser", () => {
	reset();
	// No window/document in a server test runtime.
	assert.deepEqual(getOrCreateAgentId(), "n/a");
	assert.deepEqual(getOrCreateAgentId({ storageKey: "anything" }), "n/a");
	restoreConsole();
});

/**
 * Runs `fn` against a minimal browser-shape global so isBrowser() returns
 * true. Node and Deno define `localStorage` as a non-trivial accessor; use
 * defineProperty to install a plain mock for the duration of the call.
 */
function withBrowserMock(
	storage: {
		getItem: (k: string) => string | null;
		setItem: (k: string, v: string) => void;
	},
	fn: () => void,
) {
	// biome-ignore lint/suspicious/noExplicitAny: installs browser globals
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
			value: storage,
			configurable: true,
			writable: true,
		});
		fn();
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
}

// Note: agent ids are memoized per storageKey for the module's lifetime, so
// each test below uses its own key.

test("getOrCreateAgentId uses configured storageKey (browser mock)", () => {
	reset();

	const store = new Map<string, string>();
	const fakeLocalStorage = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => {
			store.set(k, v);
		},
	};

	withBrowserMock(fakeLocalStorage, () => {
		const id1 = getOrCreateAgentId({ storageKey: "custom-key" });
		assert(id1 && id1 !== "n/a");
		assert.deepEqual(store.get("custom-key"), id1);

		// Same key returns same id
		const id2 = getOrCreateAgentId({ storageKey: "custom-key" });
		assert.deepEqual(id1, id2);

		// Default key writes a separate entry
		const idDefault = getOrCreateAgentId();
		assert(idDefault !== id1);
		assert.deepEqual(store.get(DEFAULT_AGENT_ID_STORAGE_KEY), idDefault);
	});

	restoreConsole();
});

test("getOrCreateAgentId reuses an id already in storage", () => {
	reset();

	const store = new Map([["existing-key", "stored-id"]]);
	withBrowserMock(
		{
			getItem: (k) => store.get(k) ?? null,
			setItem: (k, v) => void store.set(k, v),
		},
		() => {
			assert.deepEqual(getOrCreateAgentId({ storageKey: "existing-key" }), "stored-id");
		},
	);

	restoreConsole();
});

test("getOrCreateAgentId is stable when getItem throws (one console.error)", () => {
	reset();

	withBrowserMock(
		{
			getItem: () => {
				throw new Error("storage blocked");
			},
			setItem: () => {
				throw new Error("storage blocked");
			},
		},
		() => {
			const id1 = getOrCreateAgentId({ storageKey: "getitem-throws-key" });
			const id2 = getOrCreateAgentId({ storageKey: "getitem-throws-key" });
			const id3 = getOrCreateAgentId({ storageKey: "getitem-throws-key" });
			assert(id1 && id1 !== "n/a");
			assert.deepEqual(id2, id1);
			assert.deepEqual(id3, id1);
		},
	);

	// getItem and setItem each fail once — on the first call only.
	assert.deepEqual(consoleOutput.error.length, 2);
	assert(consoleOutput.error[0]!.includes("Unable to read agent id"));
	assert(consoleOutput.error[1]!.includes("Unable to persist agent id"));

	restoreConsole();
});

test("getOrCreateAgentId is stable when setItem throws (one console.error)", () => {
	reset();

	withBrowserMock(
		{
			getItem: () => null,
			setItem: () => {
				throw new Error("quota exceeded");
			},
		},
		() => {
			const id1 = getOrCreateAgentId({ storageKey: "setitem-throws-key" });
			const id2 = getOrCreateAgentId({ storageKey: "setitem-throws-key" });
			assert(id1 && id1 !== "n/a");
			assert.deepEqual(id2, id1);
		},
	);

	assert.deepEqual(consoleOutput.error.length, 1);
	assert(consoleOutput.error[0]!.includes("Unable to persist agent id"));

	restoreConsole();
});
