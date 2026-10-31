/**
 * Shared test helpers for clog test suite
 */

import { createClog, type LogData } from "../src/clog.ts";

type ConsoleMethod = "debug" | "log" | "warn" | "error";

// Test output collectors
export let capturedData: LogData[] = [];
export let consoleOutput: Record<ConsoleMethod, string[]> = {
	debug: [],
	log: [],
	warn: [],
	error: [],
};

// Mock console for testing
const originalConsole = { ...console };

export function setupMockConsole() {
	consoleOutput = { debug: [], log: [], warn: [], error: [] };
	(["debug", "log", "warn", "error"] as const).forEach((method) => {
		console[method] = (...args: unknown[]) => {
			consoleOutput[method].push(args.join(" "));
		};
	});
}

export function restoreConsole() {
	Object.assign(console, originalConsole);
}

export function reset() {
	capturedData = [];
	createClog.reset();
	setupMockConsole();
}

export function resetCapturedData() {
	capturedData = [];
}

export function pushCapturedData(data: LogData) {
	capturedData.push(data);
}
