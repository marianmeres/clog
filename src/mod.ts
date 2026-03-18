/**
 * @module
 * Configurable, namespace-aware console logger for browser, Node, and Deno.
 *
 * Provides {@linkcode createClog} for creating namespaced loggers with optional
 * color support, structured JSON output, log hooks, and custom writers.
 * Also re-exports color utilities ({@linkcode colored}, {@linkcode autoColor},
 * named color shortcuts) for styled console output.
 */
export * from "./clog.ts";
export * from "./colors.ts";
