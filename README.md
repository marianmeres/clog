# @marianmeres/clog

[![NPM version](https://img.shields.io/npm/v/@marianmeres/clog.svg)](https://www.npmjs.com/package/@marianmeres/clog)
[![JSR version](https://jsr.io/badges/@marianmeres/clog)](https://jsr.io/@marianmeres/clog)

Simple, universal logger with namespace support that works everywhere - browser, Node.js, and Deno.

## Why clog?

- **Console-compatible API** - Drop-in replacement for `console.log/debug/warn/error`
- **Works everywhere** - Single API for browser and server environments
- **Auto-adapts** - Detects environment and outputs appropriately
- **Namespace support** - Organize logs by module/component
- **Structured logging** - JSON output for log aggregation tools
- **Colored output** - Color shortcuts for readable logs
- **Extensible** - Hook into logs for batching/collection
- **Tiny** - Zero dependencies

## Installation

```bash
npm i @marianmeres/clog
```

```bash
deno add jsr:@marianmeres/clog
```

## Quick Start

```typescript
import { createClog } from "@marianmeres/clog";

// Create logger with namespace
const clog = createClog("my-app");

// Use like console
clog.log("Hello", "world"); // [my-app] Hello world
clog.debug("Debug info"); // [my-app] Debug info
clog.warn("Warning message"); // [my-app] Warning message
clog.error("Error occurred"); // [my-app] Error occurred

// Or call directly (proxies to .log)
clog("Hello", "world"); // [my-app] Hello world

// Without namespace
const logger = createClog();
logger.log("No namespace"); // No namespace

// Return value useful for throwing
throw new Error(clog.error("Something failed"));
```

## Design Philosophy

**No filtering by log level** - This library intentionally does not include `LOG_LEVEL` filtering. If you don't want certain logs, don't write them. Use your hook to filter if really needed.

**No enable/disable switches** - Control what you log at the source.

**Console-compatible** - You can replace `console.log` with `clog.log` without changing anything else. The `Logger` interface is designed so that `console` itself satisfies it.

**One API for all environments** - Auto-detection means you write code once, it works everywhere.

## Browser vs Server: Two Distinct Modes

This library operates in **two fundamentally different modes** based on runtime detection:

### Browser Mode

- Rich, interactive output using native browser console features
- Colored namespace labels via `%c` formatting
- Inline colored text with color shortcuts
- Objects displayed with expandable inspection

### Server Mode (Node.js, Deno)

- **Machine-friendly output by design**
- ISO timestamps prepended to every line
- Structured plain text: `[timestamp] [LEVEL] [namespace] message`
- Optional JSON output for log aggregation tools

### Why This Matters

This is an **intentional, pragmatic design decision**. Server logs serve a different purpose than browser console output:

- They're consumed by log aggregators
- They're grepped, parsed, and filtered by automated tools
- They need consistent, predictable structure
- Timestamps are essential for debugging distributed systems

Fancy colors, complex formatting, and visual embellishments on the server provide no value - they actually make logs _harder_ to process and search.

### Is This Library Right for You?

✅ **Good fit if you want:**

- Single API that works everywhere
- Browser logs with colors and rich formatting
- Server logs optimized for machine consumption
- JSON output for log aggregation

❌ **Not the best fit if you want:**

- Colorful, visually styled output in server terminals
- ASCII art, box drawing, or rich formatting in CLI tools
- The same visual experience in both environments

## Why `any` Return Type?

The `Logger` interface methods return `any` instead of `string` to ensure true compatibility with `console`:

```typescript
// This works because Logger uses `any` return type
const logger: Logger = console; // ✓ console methods return void
const clog: Logger = createClog("app"); // ✓ clog methods return string
```

Console methods return `void`, but clog returns the first argument as a string (useful for patterns like `throw new Error(clog.error("msg"))`). Using `any` as the return type allows both implementations to satisfy the same interface, enabling polymorphic use of loggers throughout your codebase.

## Features

### Namespace Support

Organize logs by module, component, or feature:

```typescript
// In different modules
const authLog = createClog("auth");
const apiLog = createClog("api");
const dbLog = createClog("database");

authLog.log("User logged in"); // [auth] User logged in
apiLog.warn("Slow request"); // [api] Slow request
dbLog.error("Connection failed"); // [database] Connection failed
```

### Nested Namespaces

Use `withNamespace()` to attach an additional namespace to a logger:

```typescript
import { createClog, withNamespace } from "@marianmeres/clog";

const appLog = createClog("app");
const moduleLog = withNamespace(appLog, "auth");

moduleLog.log("User logged in"); // [app] [auth] User logged in
moduleLog.ns; // "app:auth" — composed namespace

// Deep nesting composes further
const subLog = withNamespace(moduleLog, "oauth");
subLog.ns; // "app:auth:oauth"
subLog.warn("Token expired"); // [app] [auth] [oauth] Token expired

// Works with native console (arg-prefix mode)
const consoleLog = withNamespace(console, "my-module");
consoleLog.error("Something failed"); // [my-module] Something failed

// Return value pattern works at any nesting depth
throw new Error(moduleLog.error("Authentication failed"));
```

**How it composes.** When the wrapped target is a clog instance, `withNamespace` returns a _fresh_ clog whose `ns` is the parent's namespace joined with `:`. The renderer splits that back into `[parent] [child]` for readable text output and uses the composed string as-is in JSON (`"namespace":"app:auth"`). When the target is any other logger (e.g. native `console`), the wrapper prepends `[namespace]` as the first argument on every call, as before.

### Auto-Environment Detection

**Browser**: Pretty console output with native browser features

```typescript
const clog = createClog("ui");
clog.log("Rendering", { count: 42 });
// Output: [ui] Rendering { count: 42 }
// Uses browser's console styling
```

**Server**: Structured output ready for log aggregation

```typescript
const clog = createClog("api");
clog.log("Request received", { method: "GET" });
// Output: [2025-11-29T10:30:45.123Z] [INFO] [api] Request received { method: 'GET' }
```

### Structured JSON Logging

Enable JSON output for server logs:

```typescript
// Enable globally
createClog.global.jsonOutput = true;

// …or per-instance (since v3.16). Instance setting wins if defined.
const clog = createClog("api", { jsonOutput: true });
clog.log("Request received", { method: "GET", path: "/users" });

// Output (single line):
// {"timestamp":"2025-11-29T10:30:45.123Z","level":"INFO","logger":"api","message":"Request received","arg_0":{"method":"GET","path":"/users"}}
```

When the logger has no namespace, the `logger` field is **omitted** (instead of being emitted as `false`), matching how `meta` is handled.

> **BC note (v3.18):** the namespace field is now emitted as `"logger"` (was `"namespace"`). `"logger"` matches the convention used by OpenTelemetry, Elastic Common Schema, Datadog, and most JVM-ecosystem tools. To restore the old name (or any other field name), use `jsonFieldNames` — see below.

#### Renaming JSON fields (`jsonFieldNames`)

Most log aggregators expect specific top-level field names. Use `jsonFieldNames` to rename any of them without writing a custom writer. Resolution is **per-key**: instance config > global config > default. Any key you omit keeps its default name.

```typescript
// Restore the pre-3.18 default for the namespace field:
createClog.global.jsonFieldNames = { logger: "namespace" };

// Or pick the convention your aggregator wants (e.g. ECS-ish):
createClog.global.jsonFieldNames = {
	timestamp: "@timestamp",
	level: "log.level",
	logger: "log.logger",
	message: "message",
};

// Per-instance override (only the keys you specify; others fall back to global / default):
const clog = createClog("api", {
	jsonOutput: true,
	jsonFieldNames: { logger: "service" },
});
```

The full set of renamable keys is `timestamp`, `level`, `logger`, `message`, `meta`, `arg`, `stack`. The `arg` key is special — it's the **prefix** used for sequenced extra args (`arg_0`, `arg_1`, …); renaming it to `"extra"` produces `extra_0`, `extra_1`, … When the logger has no namespace, the `logger` field (under whatever name you chose) is still omitted — same as before.

#### Top-level meta fields (`jsonTopLevelMeta`)

Some log collectors read certain fields only from the top level of a line. For example, the OpenTelemetry Collector's `trace_parser` looks for `trace_id` / `span_id` there, and doesn't see `meta.trace_id`. List the meta keys to move to the top level (since v3.23):

```typescript
createClog.global.jsonOutput = true;
createClog.global.getMeta = () => ({ trace_id: "4bf9…", span_id: "00f0…", user: "u1" });
createClog.global.jsonTopLevelMeta = ["trace_id", "span_id"];

createClog("api").log("hello");
// {"timestamp":"…","level":"INFO","logger":"api","message":"hello",
//  "trace_id":"4bf9…","span_id":"00f0…","meta":{"user":"u1"}}
```

- A listed key is **moved**, not copied: it is written at the top level under its own name and left out of `meta`. When nothing is left, `meta` is omitted. A listed key that meta doesn't have (or has as `undefined`) produces no field.
- **Core fields are never overwritten.** A key equal to a core field name (`timestamp`, `level`, `logger`, `message`, `meta`, `stack`, as renamed by `jsonFieldNames`) or of the form `arg_<n>` is not promoted and stays in `meta`.
- **Presentation only.** `LogData.meta` is not changed, so hooks, custom writers and the log forwarder still see every key.
- JSON output only. A per-instance `jsonTopLevelMeta` **replaces** the global list (`[]` turns promotion off for that logger). The global list is read at write time, so it applies to loggers created before it was set. To add keys without dropping someone else's:
  ```typescript
  createClog.global.jsonTopLevelMeta = [
  	...new Set([...(createClog.global.jsonTopLevelMeta ?? []), "trace_id", "span_id"]),
  ];
  ```

#### Writing lines without a logger (`toJsonRecord`)

`toJsonRecord(data)` returns the object the default writer serializes in JSON mode. Use it when you write lines yourself but want clog's shape (including `jsonFieldNames` and `jsonTopLevelMeta`). The typical case is a server endpoint relaying entries from the browser log forwarder. A logger would stamp a new timestamp, run the global hook, and merge the server's own `getMeta` (overwriting the browser's trace ids). `toJsonRecord` does none of that: it uses `data` as given.

```typescript
import { toJsonRecord } from "@marianmeres/clog";

// `entries`: LogData objects posted by the browser's log forwarder
for (const e of entries) {
	const record = toJsonRecord({
		level: e.level,
		namespace: e.namespace,
		args: e.args,
		timestamp: e.timestamp,
		meta: e.meta,
	});
	console.log(JSON.stringify(record));
}
```

### Log Levels

Maps console methods to standard log levels (RFC 5424):

```typescript
import { LEVEL_MAP } from "@marianmares/clog";

clog.debug("Debug"); // DEBUG
clog.log("Info"); // INFO
clog.warn("Warning"); // WARNING
clog.error("Error"); // ERROR
```

### Return Value Pattern

All log methods return the first argument as a string (typed as `any` for console compatibility), useful for error handling:

```typescript
const clog = createClog("auth");

// Convenient error throwing
throw new Error(clog.error("Authentication failed"));
```

Under `stringify` or `concat` modes, the return value is the JSON-rendered form, so it **matches what was logged**:

```typescript
const clog = createClog("api", { stringify: true });
const ret = clog.error({ code: 500, msg: "boom" });
// ret === '{"code":500,"msg":"boom"}'
// (pre-3.16 returned "[object Object]")

throw new Error(ret); // Error message carries the full JSON
```

### Global Hook (Batching/Collection)

Capture all logs across your application for batching, analytics, or remote logging:

```typescript
// Set up once at app bootstrap
const logBatch = [];

createClog.global.hook = (data) => {
	logBatch.push(data);

	// Flush batch every 100 logs
	if (logBatch.length >= 100) {
		sendToLogServer(logBatch);
		logBatch.length = 0;
	}
};

// Now all logger instances will trigger the hook
const auth = createClog("auth");
const api = createClog("api");

auth.log("Login attempt"); // Added to batch
api.warn("Slow query"); // Added to batch
```

Hook receives normalized data:

```typescript
type LogData = {
	level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
	namespace: string | false; // composed with ":" when via withNamespace
	args: any[]; // shallow clone — safe to mutate
	timestamp: string; // ISO 8601 format
	meta?: Record<string, unknown>; // lazy; computed on first read
	stack?: string[]; // present when stacktrace is enabled
};
```

#### Suppressing individual logs

Return the `CLOG_SKIP` sentinel from a hook to suppress the writer for that single call (useful for filtering):

```typescript
import { CLOG_SKIP, createClog } from "@marianmeres/clog";

createClog.global.hook = (data) => {
	if (isNoisy(data)) return CLOG_SKIP; // writer is not called
};
```

All other return values are ignored.

#### Transforming log data

The `data` object passed to the hook is the **same reference** the writer receives next, so mutating it in the hook is a supported way to transform what gets written — without rewriting the writer. Useful for value-level rewrites like prefixing the namespace (which becomes the JSON `logger` field):

```typescript
// Prefix the namespace — affects both text output ("[svc] [api] ...")
// and JSON output ({ "logger": "svc:api", ... })
createClog.global.hook = (data) => {
	if (data.namespace) data.namespace = `svc:${data.namespace}`;
};

// Redact a sensitive arg before it reaches the writer
createClog.global.hook = (data) => {
	data.args = data.args.map((a) =>
		typeof a === "string" ? a.replace(/token=\S+/g, "token=***") : a
	);
};
```

Notes:

- `data.args` is already a shallow clone of the caller's array, so mutating it (or replacing it) is safe — the caller's original array is unaffected.
- A hook can both transform _and_ return `CLOG_SKIP`. Return values other than `CLOG_SKIP` are ignored; the transform happens via the mutation, not the return value.

### Custom Writer

Replace the default output completely:

```typescript
// Global writer (affects all instances)
createClog.global.writer = (data) => {
	myCustomLogSystem.write({
		time: data.timestamp,
		severity: data.level,
		module: data.namespace,
		message: data.args.join(" "),
	});
};

// Instance-level writer
const clog = createClog("test", {
	writer: (data) => {
		console.log(`Custom: ${data.level} - ${data.args[0]}`);
	},
});
```

### Colored Namespace

Add color to **namespace labels** in browser and Deno console:

```typescript
const clog = createClog("ui", { color: "blue" });
clog.log("Button clicked");
// Output: [ui] Button clicked  (namespace in blue)

const errorLog = createClog("errors", { color: "red" });
errorLog.error("Failed to load");
// Output: [errors] Failed to load  (namespace in red)
```

Colors work in browser and Deno environments (uses `%c` formatting). Use `color: "auto"` to automatically assign a consistent color based on the namespace.

#### Color Shortcuts

For **inline colored text** within log messages, use the color shortcut functions:

```typescript
import { blue, createClog, green, red, yellow } from "@marianmeres/clog";

// namespace "app" will be auto-colored
const clog = createClog("app", { color: "auto" });

// make some of the log messages colored
clog("Status:", green("OK"));
clog("Error:", red("Connection failed"));
clog(blue("Info:"), "Processed in", yellow("42ms"));
```

Available colors: `gray`, `grey`, `red`, `orange`, `yellow`, `green`, `teal`, `cyan`, `blue`, `purple`, `magenta`, `pink`. All colors are optimized for readability on both light and dark backgrounds. In environments that don't support `%c` formatting (like Node.js), colored text is output as plain strings with no artifacts.

String concatenation also works safely: `"Status:" + green("OK")` outputs `"Status:OK"` (color is lost, but no `[object Object]` artifacts). For colored output, use comma-separated arguments instead.

### Debug Mode

Control whether `.debug()` calls produce output globally or per-instance:

```typescript
// Global: disable debug for all loggers
createClog.global.debug = process.env.NODE_ENV !== "development";

const apiLog = createClog("api");
const dbLog = createClog("db");

apiLog.debug("skipped in production"); // Respects global setting
dbLog.debug("also skipped"); // Respects global setting

// Per-instance: override global setting
const verboseLog = createClog("verbose", { debug: true });
verboseLog.debug("always outputs"); // Overrides global

// Or disable for specific logger
const quietLog = createClog("quiet", { debug: false });
quietLog.debug("never outputs"); // Overrides global
```

**Precedence:** Instance `config.debug` → Global `createClog.global.debug` → Default (`true`)

When `debug: false`, the `.debug()` method becomes a no-op (but still returns the first argument as a string for API consistency). All other log levels work normally regardless of this setting.

### Stringify Mode

Force non-primitive arguments to be JSON.stringified, making objects visible as strings:

```typescript
// Global
createClog.global.stringify = true;

// Per-instance
const clog = createClog("api", { stringify: true });
clog.log("data", { user: "john" }, [1, 2, 3]);
// Output: [timestamp] [INFO] [api] data {"user":"john"} [1,2,3]
```

Without `stringify`, objects might appear as `[object Object]` in some contexts. With `stringify: true`, they're always JSON strings.

**Precedence:** Instance `config.stringify` → Global `createClog.global.stringify` → Default (`false`)

### Concat Mode

Concatenate all arguments into a single string output. This also enables stringify behavior:

```typescript
// Global
createClog.global.concat = true;

// Per-instance
const clog = createClog("x", { concat: true });
clog(1, { hey: "ho" });
// Output: [timestamp] [INFO] [x] 1 {"hey":"ho"}
// Console receives exactly ONE string argument
```

This is useful when you need:

- Single-line log output for easier parsing/grep
- Guaranteed flat string output (no object expansion in console)
- Integration with log systems expecting single-string messages

**Precedence:** Instance `config.concat` → Global `createClog.global.concat` → Default (`false`)

| Config            | Objects        | Console args      |
| ----------------- | -------------- | ----------------- |
| neither           | as-is          | multiple          |
| `stringify: true` | JSON.stringify | multiple          |
| `concat: true`    | JSON.stringify | **single string** |

### Stacktrace Mode

> **Warning:** This feature is intended for **local development debugging only**. Do NOT use in production as capturing stack traces has significant performance overhead.

Append call stack trace to log output, showing where each log call originated:

```typescript
// Global
createClog.global.stacktrace = true;

// Per-instance
const clog = createClog("debug", { stacktrace: true });
clog.log("Where am I called from?");
// Output includes stack trace as last argument showing call site
```

You can also limit the number of stack frames:

```typescript
// Show only top 3 frames
createClog.global.stacktrace = 3;
```

With JSON output enabled, the stack trace is included as a `"stack"` field in the JSON object.

Custom writers receive the raw frames via `LogData.stack: string[] | undefined` and can render them with the exported `formatStack(lines)` helper to match the default output:

```typescript
import { createClog, formatStack } from "@marianmeres/clog";

createClog.global.stacktrace = 10;
createClog.global.writer = (data) => {
	mySink({
		msg: data.args[0],
		stack: data.stack ? formatStack(data.stack) : undefined,
	});
};
```

**Precedence:** Instance `config.stacktrace` → Global `createClog.global.stacktrace` → Default (`undefined`/disabled)

### Metadata Injection (getMeta)

Inject contextual metadata (like user ID, request ID, session info) into log entries. The metadata is available in `LogData.meta` for custom writers and hooks, but is NOT passed to console output:

```typescript
// Instance-level getMeta
const clog = createClog("api", {
	getMeta: () => ({
		userId: getCurrentUserId(),
		requestId: getRequestId(),
	}),
});

clog.log("Request received");
// Console output: [timestamp] [INFO] [api] Request received
// But LogData.meta contains: { userId: "...", requestId: "..." }

// Global getMeta (affects all instances)
createClog.global.getMeta = () => ({
	sessionId: getSessionId(),
	env: process.env.NODE_ENV,
});
```

Access metadata in custom writers or hooks:

```typescript
// In a custom writer
const clog = createClog("app", {
	getMeta: () => ({ traceId: "abc-123" }),
	writer: (data) => {
		console.log("Meta:", data.meta); // { traceId: "abc-123" }
		console.log("Message:", data.args[0]);
	},
});

// In a global hook for log collection
createClog.global.hook = (data) => {
	sendToAnalytics({
		...data,
		meta: data.meta, // { userId: "...", requestId: "..." }
	});
};
```

With JSON output enabled, metadata is automatically included:

```typescript
createClog.global.jsonOutput = true;
createClog.global.getMeta = () => ({ userId: "user-123" });

const clog = createClog("api");
clog.log("Request");

// Output: {"timestamp":"...","level":"INFO","logger":"api","message":"Request","meta":{"userId":"user-123"}}
```

#### Per-logger meta on top of the global meta (`meta`, `withMeta`)

An instance `getMeta` **replaces** the global one. To **add** meta for one logger while keeping the app-wide meta, use `config.meta` (an object, or a function called lazily per line):

```typescript
createClog.global.getMeta = () => ({ projectId, userId: getCurrentUserId() });

const log = createClog("worker", { meta: () => ({ traceId: getTraceId() }) });
log.log("job started");
// data.meta → { projectId, userId, traceId }
```

`withMeta(logger, meta)` derives a child logger with extra meta and the **same** namespace — the sibling of `withNamespace`. Layers stack, and the innermost wins on key conflicts:

```typescript
import { withMeta } from "@marianmeres/clog";

const reqLog = withMeta(log, { requestId });
const callLog = withMeta(reqLog, { attempt: 2 });
callLog.log("calling upstream");
// data.meta → { projectId, userId, traceId, requestId, attempt: 2 }
callLog.ns; // "worker"
```

`withMeta` on a logger that is not a clog instance (native `console`, `createNoopClog()`) returns that logger unchanged — it has no meta channel.

**Key points:**

- `getMeta` and `meta` are resolved **lazily** — only when a hook or writer actually reads `data.meta`. The result is cached per log call, so repeated reads resolve the sources once.
- Because it is lazy, `data.meta` reflects the state at **first read**, not at the log call. The built-in forwarder (`createLogForwarder`, and so `configureWebLogger`) reads it in its hook, so forwarded entries carry log-time meta. A custom hook that stores `data` for a later flush should do the same (`void data.meta`) — otherwise function sources run at flush time, where e.g. a request-scoped `getMeta` backed by `AsyncLocalStorage` returns nothing.
- Every source is isolated: a throwing `getMeta` or `meta` is **swallowed** and contributes nothing, and the other source still does. Logging never fails because of metadata.
- `meta` is shallow-merged over the base into a fresh object, so a hook mutating `data.meta` never changes a static `meta` object.
- The base (`getMeta`) is read per log call, so a global `getMeta` installed after a logger was created still applies to it.
- `meta` is inherited by `withNamespace` children.
- If no source returns anything (unset, `undefined`, or thrown), `data.meta` is `undefined` and no `meta` field is added to JSON output.

**Precedence:** Base = instance `config.getMeta` → global `createClog.global.getMeta` → none. Then `config.meta` (including `withMeta` layers) is merged on top and wins on key conflicts.

## API Reference

For complete API documentation, see [API.md](API.md).

### Quick Reference

```typescript
// Create a logger
const clog = createClog(namespace?, config?);

// Create a no-op logger (for testing)
const noop = createNoopClog(namespace?);

// Log methods (return first arg as string, typed as `any`)
clog.debug(...args);   // DEBUG level
clog.log(...args);     // INFO level
clog.warn(...args);    // WARNING level
clog.error(...args);   // ERROR level
clog(...args);         // Callable, same as clog.log()

// Instance properties
clog.ns;               // readonly namespace ("app" or "app:module" when composed)

// Nested namespaces (clog instance → composed; native console → arg prefix)
const nested = withNamespace(clog, "module");
nested.log("msg");     // [original-ns] [module] msg
nested.ns;             // "original-ns:module"

// Extra meta, same namespace (clog instance → child logger; other loggers → unchanged)
const reqLog = withMeta(clog, { requestId: "r1" });

// Hook suppression sentinel
import { CLOG_SKIP } from "@marianmeres/clog";
createClog.global.hook = (data) => { if (drop(data)) return CLOG_SKIP; };

// Global configuration
createClog.global.hook = (data: LogData) => { /* ... */ };
createClog.global.writer = (data: LogData) => { /* ... */ };
createClog.global.jsonOutput = true;
createClog.global.jsonFieldNames = { logger: "service" }; // rename JSON keys
createClog.global.jsonTopLevelMeta = ["trace_id"]; // meta keys at the JSON top level
createClog.global.debug = false;     // disable debug globally
createClog.global.stringify = true;  // JSON.stringify objects
createClog.global.concat = true;     // single string output
createClog.global.stacktrace = true; // append call stack (dev only!)
createClog.global.getMeta = () => ({ userId: "..." }); // metadata injection

// Reset global config
createClog.reset();

// The JSON line object for a LogData, without a logger (e.g. to relay entries)
const record = toJsonRecord(data);
```

### Types

```typescript
interface ClogConfig {
	writer?: WriterFn;
	color?: string | null;
	debug?: boolean; // when false, .debug() is a no-op
	stringify?: boolean; // JSON.stringify non-primitive args
	concat?: boolean; // concatenate all args into single string
	stacktrace?: boolean | number; // capture call stack (dev only!)
	jsonOutput?: boolean; // overrides global.jsonOutput (v3.16+)
	jsonFieldNames?: JsonFieldNames; // rename JSON output keys (v3.18+)
	jsonTopLevelMeta?: readonly string[]; // replaces global list; [] = off (v3.23+)
	getMeta?: () => Record<string, unknown>; // metadata injection (replaces global)
	meta?: Record<string, unknown> | (() => Record<string, unknown>); // merged over getMeta
}

interface GlobalConfig {
	hook?: HookFn;
	writer?: WriterFn;
	jsonOutput?: boolean;
	jsonFieldNames?: JsonFieldNames; // rename JSON output keys (v3.18+)
	jsonTopLevelMeta?: readonly string[]; // meta keys at the JSON top level (v3.23+)
	debug?: boolean; // can be overridden per-instance
	stringify?: boolean; // can be overridden per-instance
	concat?: boolean; // can be overridden per-instance
	stacktrace?: boolean | number; // can be overridden per-instance (dev only!)
	getMeta?: () => Record<string, unknown>; // can be overridden per-instance
}

type JsonFieldKey =
	| "timestamp"
	| "level"
	| "logger"
	| "message"
	| "meta"
	| "arg"
	| "stack";
type JsonFieldNames = Partial<Record<JsonFieldKey, string>>;

type LogData = {
	level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
	namespace: string | false; // composed with ":" when via withNamespace
	args: any[]; // shallow clone of caller's arguments
	timestamp: string;
	config?: ClogConfig; // instance config (for custom writers)
	meta?: Record<string, unknown>; // lazy getter: getMeta + config.meta; throws swallowed
	stack?: string[]; // set when stacktrace is enabled (v3.16+)
};

type HookFn = (data: LogData) => void | typeof CLOG_SKIP;
```

## Examples

### Basic Usage

```typescript
import { createClog } from "@marianmares/clog";

const clog = createClog("app");

clog.debug("Debugging info", { userId: 123 });
clog.log("User logged in");
clog.warn("Session expiring soon");
clog.error("Failed to save", new Error("DB connection lost"));
```

### Multiple Modules

```typescript
// auth.ts
const authLog = createClog("auth");
authLog.log("Login attempt", { email: "user@example.com" });

// api.ts
const apiLog = createClog("api");
apiLog.warn("Rate limit approaching", { remaining: 10 });

// database.ts
const dbLog = createClog("db");
dbLog.error("Query timeout", { query: "SELECT * FROM users" });
```

### Environment-Specific Output

```typescript
// Development: readable text logs (default)
const clog = createClog("api");
clog.log("Request received");
// [2025-11-29T10:30:45.123Z] [INFO] [api] Request received

// Production: enable JSON logs for aggregation
createClog.global.jsonOutput = true;
const clog2 = createClog("api");
clog2.log("Request received", { userId: 123 });
// {"timestamp":"2025-11-29T10:30:45.123Z","level":"INFO","logger":"api","message":"Request received","arg_0":{"userId":123}}
```

### Testing with No-Op Logger

For tests where you want to suppress all console output, use `createNoopClog`:

```typescript
import { createNoopClog } from "@marianmeres/clog";

// Create a silent logger - no output at all
const clog = createNoopClog("test");

clog.log("silent"); // returns "silent", outputs nothing
clog.error("fail"); // returns "fail", outputs nothing

// Return value pattern still works
throw new Error(clog.error("Something failed"));
```

### Testing with Mock Writer

```typescript
// test.ts
import { createClog } from "@marianmeres/clog";
import { assertEquals } from "@std/assert";

Deno.test("logs correct message", () => {
	const captured: string[] = [];

	createClog.global.writer = (data) => {
		captured.push(data.args[0]);
	};

	const clog = createClog("test");
	clog.log("Hello");

	assertEquals(captured[0], "Hello");

	createClog.reset(); // Clean up
});
```

### Log Forwarder (Included Battery)

> **Installation note for `/forward` and `/web`**
>
> Both `@marianmeres/clog/forward` and `@marianmeres/clog/web` depend on
> [`@marianmeres/batch`](https://github.com/marianmeres/batch) at runtime.
> Because batch and clog are intentionally decoupled, batch is declared as an
> **optional peer dependency** — install it directly in projects that use
> either subpath:
>
> ```bash
> npm install @marianmeres/batch
> ```
>
> Projects using only the main `@marianmeres/clog` API (logging without
> forwarding) do not need batch.

For production log batching and forwarding, use the included `createLogForwarder` utility:

```typescript
import { createClog } from "@marianmeres/clog";
import { createLogForwarder } from "@marianmeres/clog/forward";

const forwarder = createLogForwarder(
	async (logs) => {
		await fetch("/api/logs", { method: "POST", body: JSON.stringify(logs) });
		return true;
	},
	{ flushIntervalMs: 5000, flushThreshold: 50, maxBatchSize: 1000 },
);

createClog.global.hook = forwarder.hook;

// Graceful shutdown
process.on("SIGTERM", async () => {
	await forwarder.drain();
	process.exit(0);
});
```

The forwarder wraps [@marianmeres/batch](https://github.com/marianmeres/batch) and provides:

- **Time-based flushing** (`flushIntervalMs`) - flush every N ms
- **Threshold-based flushing** (`flushThreshold`) - flush when buffer reaches N items
- **Buffer overflow protection** (`maxBatchSize`) - oldest items discarded if exceeded
- **Graceful shutdown** (`drain()`) - flush remaining items before exit
- **State monitoring** (`subscribe()`) - observe buffer size and flush status

Full API: `hook`, `add`, `flush`, `drain`, `start`, `stop`, `reset`, `dump`, `configure`, `subscribe`, `size`, `isRunning`, `isFlushing`

### Web Preset (Included Battery)

For typical frontend setups (browser apps that ship logs to a backend), the `@marianmeres/clog/web` subpath bundles the usual wiring: forwarder + global error/rejection capture + `getMeta` installation + a persistent agent-id helper. You provide the `send` callback that encodes your own server contract.

```typescript
import { configureWebLogger, getOrCreateAgentId } from "@marianmeres/clog/web";

const agentId = getOrCreateAgentId({ storageKey: "my-app-agent-id" });

const forwarder = configureWebLogger({
	send: async (logs) => {
		await fetch("/api/logs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ entries: logs }),
			keepalive: true,
		});
	},
	flushIntervalMs: 2000,
	getMeta: () => ({ agentId, userId: getCurrentUserId() }),
});

// Pause forwarding (console logging continues):
forwarder?.stop();

// Flush remaining buffer on unload:
globalThis.addEventListener("beforeunload", () => forwarder?.drain());
```

Omitting `send` runs in console-only mode — `getMeta` and the error handlers still install, but nothing is shipped over the network. Returns `undefined` outside a browser-style runtime (no `addEventListener`).

`getOrCreateAgentId()` memoizes the id per `storageKey` for the page's lifetime, so calling it inside `getMeta` on every line is cheap and stable — even when `localStorage` is blocked or full (the failure is logged to `console.error` once).

## Global Configuration Across Bundled Dependencies

When using `@marianmeres/clog` in an application with multiple dependencies that each bundle their own copy of the library, the global configuration (`createClog.global`) is **truly shared** across all instances.

This works because the global state uses `Symbol.for()` + `globalThis`:

```typescript
// Internally, clog stores global config like this:
const GLOBAL_KEY = Symbol.for("@marianmeres/clog");
const GLOBAL = (globalThis as any)[GLOBAL_KEY] ??= {/* defaults */};
```

This means:

- ✅ Set `createClog.global.jsonOutput = true` once at app bootstrap
- ✅ All components (even deeply nested dependencies) see that config
- ✅ A global hook captures logs from every clog instance in your app
- ✅ Works regardless of how many copies of clog exist in `node_modules`

```typescript
// app.ts - set once at startup
import { createClog } from "@marianmeres/clog";
createClog.global.jsonOutput = true;
createClog.global.hook = (data) => sendToAnalytics(data);

// Any dependency using @marianmeres/clog will automatically
// use JSON output and trigger your hook
```

## Upgrade notes (v3.22 → v3.23)

Additive, plus one bug fix:

- **New: `jsonTopLevelMeta`** (instance + global) — meta keys written as top-level JSON fields instead of inside `meta`. Without it, JSON output is unchanged. See "Top-level meta fields" above.
- **New: `toJsonRecord(data)`** — the JSON line object the default writer serializes, for writing clog-shaped lines without a logger. See "Writing lines without a logger" above.
- **Fix:** on Deno, a JSON-mode line whose args contained styled text (`red("…")`, `colored(…)`) was written as `%c` text instead of JSON. It is now JSON, with the styles stripped.

## Upgrade notes (v3.17 → v3.18)

**One BC change** to a JSON output default, plus one additive feature:

- **JSON output: `"namespace"` field renamed to `"logger"`.** This brings the default in line with OpenTelemetry / ECS / Datadog conventions and removes the need consumers had to rewrite the JSON shape downstream. If your aggregator pipeline expects the literal field name `"namespace"`, restore it with one line:
  ```typescript
  createClog.global.jsonFieldNames = { logger: "namespace" };
  ```
  Visible text output (`[ns] message`) and `LogData.namespace` (the type field) are unchanged — only the JSON output key renamed.
- **New: `jsonFieldNames`** (instance + global) — a `Partial<Record<JsonFieldKey, string>>` map for renaming any of the JSON output keys (`timestamp`, `level`, `logger`, `message`, `meta`, `arg`, `stack`). See "Renaming JSON fields" above.

## Upgrade notes (v3.15 → v3.16)

No API was removed or renamed. A handful of behaviors changed — most are bug fixes:

- **`clog.log(obj)` return value** under `stringify`/`concat` now matches the logged form (JSON instead of `"[object Object]"`). If you relied on the old `"[object Object]"` return, update accordingly.
- **`withNamespace(clog, "child")`** now composes structurally. `ns` becomes `"parent:child"`, `LogData.namespace` carries that string, and JSON output's `namespace` field finally contains the real composition (previously, the child's name was dropped into `message`). Visible text output is unchanged. Native-`console` wrapping is unchanged.
- **`LogData.args`** is now a shallow clone of the caller's arguments. Hooks and writers can still mutate it, but the mutation no longer leaks back to the caller.
- **`LogData.meta`** is a lazy getter. `getMeta()` only runs when a consumer reads `.meta`, and a throwing `getMeta()` is now swallowed — your logs no longer crash when metadata fails.
- **JSON output when `namespace === false`** no longer emits the `namespace` field (matches how `meta` is handled).
- **`stacktrace`** now also populates `LogData.stack: string[]` so custom writers can consume it. Stack frame filtering uses path matching, so wrapped call sites (e.g. through `withNamespace`) no longer show internal `_apply`/writer frames.
- **New:** `CLOG_SKIP` symbol (return from a hook to suppress the writer), `formatStack(lines)` helper, `ClogConfig.jsonOutput` (per-instance override), and `createNoopClog` now accepts `false` in addition to `null`.

See `AGENTS.md` → "Behavior changes in v3.16" for the full BC-risk table.

## Migrating from v2.x

The v3.0 refactor simplified the API significantly:

**Removed:**

- `createLogger()` - Use `createClog()` instead
- `createClogStr()` - No longer needed
- `info()` method - Use `log()` (maps to INFO level)
- `DISABLED` global flag - Remove or don't log
- `CONFIG` object with complex flags - Simplified to `global.jsonOutput`
- `COLORS` flag - Color now per-instance only
- Chainable color API - Use config instead
- Time/dateTime options - Timestamps always in server mode

**Migration examples:**

```typescript
// v2.x
const logger = createLogger("api", true); // JSON output
logger.log("message");

// v3.x
createClog.global.jsonOutput = true;
const logger = createClog("api");
logger.log("message");

// v2.x
const clog = createClog("ui").color("red").log("msg");

// v3.x
const clog = createClog("ui", { color: "red" });
clog.log("msg");

// v2.x
createClog.DISABLED = true;

// v3.x
// Remove or use custom writer that no-ops
createClog.global.writer = () => {};
```

## License

[MIT](LICENSE)
