/**
 * Shared test helpers for clog test suite
 */

import { createClog, type LogData } from "../src/clog.ts";

// Test output collectors
export let capturedData: LogData[] = [];
export let consoleOutput: Record<string, string[]> = {};

// Mock console for testing
const originalConsole = { ...console };

export function setupMockConsole() {
	consoleOutput = { debug: [], log: [], warn: [], error: [] };
	["debug", "log", "warn", "error"].forEach((method) => {
		// deno-lint-ignore no-explicit-any
		(console as any)[method] = (...args: any[]) => {
			consoleOutput[method].push(args.join(" "));
		};
	});
}

export function restoreConsole() {
	Object.assign(console, originalConsole);
}

export function reset() {
	capturedData = [];
	consoleOutput = {};
	createClog.reset();
	setupMockConsole();
}

export function resetCapturedData() {
	capturedData = [];
}

export function pushCapturedData(data: LogData) {
	capturedData.push(data);
}
