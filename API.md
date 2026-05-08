# API Reference

Complete API documentation for `@marianmeres/clog`.

> **v3.18 changes:** JSON output's default `"namespace"` field is now emitted as `"logger"` (matches OTel/ECS/Datadog). New `jsonFieldNames` config (instance + global) renames any of the JSON output keys (`timestamp`, `level`, `logger`, `message`, `meta`, `arg`, `stack`). To restore the old name: `createClog.global.jsonFieldNames = { logger: "namespace" }`. See the README for the full upgrade note.
>
> **v3.16 additions:** `CLOG_SKIP` sentinel (return from a hook to drop a log), `formatStack(lines)` helper, `ClogConfig.jsonOutput` (per-instance override), `LogData.stack` (raw frames for custom writers), `LogData.meta` is now lazy and swallows `getMeta` exceptions, `withNamespace` on a clog composes `LogData.namespace` structurally (`"parent:child"`). See the README for a full upgrade summary.

## Table of Contents

- [createClog()](#createclog)
- [createClog.global](#createclogglobal)
- [createClog.reset()](#createclogreset)
- [createNoopClog()](#createnoopclog)
- [withNamespace()](#withnamespace)
- [createLogForwarder()](#createlogforwarder)
- [LEVEL_MAP](#level_map)
- [stringifyValue()](#stringifyvalue)
- [formatStack()](#formatstack)
- [CLOG_SKIP](#clog_skip)
- [Color Functions](#color-functions)
  - [colored()](#colored)
  - [Color Shortcuts](#color-shortcuts)
  - [SAFE_COLORS](#safe_colors)
  - [autoColor()](#autocolor)
- [Types](#types)
  - [Clog](#clog)
  - [Logger](#logger)
  - [LogData](#logdata)
  - [LogLevel](#loglevel)
  - [WriterFn](#writerfn)
  - [HookFn](#hookfn)
  - [ClogConfig](#clogconfig)
  - [GlobalConfig](#globalconfig)
  - [JsonFieldKey](#jsonfieldkey)
  - [JsonFieldNames](#jsonfieldnames)
  - [StyledText](#styledtext)
  - [ColorName](#colorname)

---

## createClog()

Creates a Clog logger instance with optional namespace and configuration.

```typescript
function createClog(namespace?: string | false, config?: ClogConfig): Clog
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `namespace` | `string \| false` | `false` | Logger namespace for prefixing log output |
| `config` | `ClogConfig` | `undefined` | Optional instance-level configuration |

### Returns

A callable `Clog` logger instance.

### Examples

```typescript
import { createClog } from "@marianmeres/clog";

// Basic usage with namespace
const clog = createClog("my-app");
clog.log("Hello");           // [my-app] Hello
clog("Hello");               // Same as above (callable)

// Without namespace
const logger = createClog();
logger.warn("Warning!");     // Warning!

// With color (browser/Deno only)
const colored = createClog("ui", { color: "blue" });

// With custom writer
const custom = createClog("test", {
  writer: (data) => console.log(`[${data.level}] ${data.args[0]}`)
});

// Error throwing pattern
throw new Error(clog.error("Failed"));
```

---

## createClog.global

Global configuration object affecting all Clog instances.

```typescript
createClog.global: GlobalConfig
```

**Note:** The global config uses `Symbol.for("@marianmeres/clog")` + `globalThis` internally, ensuring it is truly shared across multiple bundled copies of the library. This means setting `createClog.global.jsonOutput = true` in your app will affect all dependencies that use `@marianmeres/clog`, even if they bundle their own copy.

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `hook` | `HookFn \| undefined` | `undefined` | Function called before every log (for batching/analytics) |
| `writer` | `WriterFn \| undefined` | `undefined` | Global writer that overrides all instance writers |
| `jsonOutput` | `boolean` | `false` | Enable JSON output format for server environments |
| `jsonFieldNames` | `JsonFieldNames \| undefined` | `undefined` | Per-field rename map for JSON output (per-key resolution: instance > global > default). See [JsonFieldNames](#jsonfieldnames). |
| `debug` | `boolean \| undefined` | `undefined` | Global debug mode (can be overridden per-instance) |
| `stringify` | `boolean \| undefined` | `undefined` | JSON.stringify non-primitive args (can be overridden per-instance) |
| `concat` | `boolean \| undefined` | `undefined` | Concatenate all args into single string (can be overridden per-instance) |
| `stacktrace` | `boolean \| number \| undefined` | `undefined` | Append call stack to output (can be overridden per-instance). **Dev only - not for production!** |
| `getMeta` | `(() => Record<string, unknown>) \| undefined` | `undefined` | Function returning metadata to include in LogData (can be overridden per-instance) |

### Examples

```typescript
// Enable JSON output
createClog.global.jsonOutput = true;

// Set up log batching
const batch: LogData[] = [];
createClog.global.hook = (data) => batch.push(data);

// Custom global writer
createClog.global.writer = (data) => sendToServer(data);

// Disable debug globally (instances can override)
createClog.global.debug = false;

// Stringify objects in log output
createClog.global.stringify = true;

// Output single concatenated string
createClog.global.concat = true;

// Append call stack trace (dev only!)
createClog.global.stacktrace = true;
// Or limit to N frames
createClog.global.stacktrace = 3;

// Inject metadata into all logs
createClog.global.getMeta = () => ({
  userId: getCurrentUserId(),
  requestId: getRequestId()
});

// Rename JSON output keys (e.g. for log aggregator compatibility)
createClog.global.jsonFieldNames = {
  timestamp: "@timestamp",
  level: "log.level",
  logger: "log.logger",
};
```

### Writer Precedence

Writers are selected in this order (highest to lowest precedence):

1. `createClog.global.writer` - Global writer overrides everything
2. `config.writer` - Instance-level writer
3. Color writer - If `config.color` is set (browser/Deno only)
4. Default writer - Built-in environment-aware output

---

## createClog.reset()

Resets global configuration to default values.

```typescript
createClog.reset(): void
```

Clears `hook`, `writer`, `jsonFieldNames`, `debug`, `stringify`, `concat`, `stacktrace`, `getMeta`, and sets `jsonOutput` to `false`. Useful for testing to ensure clean state between tests.

### Example

```typescript
// In test teardown
afterEach(() => {
  createClog.reset();
});
```

---

## createNoopClog()

Creates a no-op logger that satisfies the `Clog` interface but doesn't output anything. Useful for testing scenarios where console output is not desired.

```typescript
function createNoopClog(namespace?: string | false | null): Clog
```

Signature widened in v3.16 to accept `false` (for symmetry with `createClog`) alongside `null`. Any falsy value disables the namespace.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `namespace` | `string \| false \| null` | `undefined` | Optional namespace (accessible via `.ns` property) |

### Returns

A callable `Clog` logger instance that outputs nothing.

### Behavior

- All methods (`debug`, `log`, `warn`, `error`) return the first argument as a string
- The callable interface returns the first argument as a string
- No output is produced (no console calls, no hooks triggered, no writers called)
- The `.ns` property is readonly and returns the namespace or `false`

### Examples

```typescript
import { createNoopClog } from "@marianmeres/clog";

// Create a silent logger for testing
const clog = createNoopClog("test");

clog.log("silent");        // returns "silent", outputs nothing
clog.error("fail");        // returns "fail", outputs nothing
clog("callable");          // returns "callable", outputs nothing

// Return value pattern works
throw new Error(clog.error("Something failed"));

// Namespace property
console.log(clog.ns);      // "test"

// Without namespace
const noNs = createNoopClog();
console.log(noNs.ns);      // false
```

### Use Cases

- **Unit tests**: Suppress log output while testing functions that use logging
- **Mock logger injection**: Pass to modules that expect a logger but shouldn't output during tests
- **Benchmarking**: Measure performance without I/O overhead from logging

---

## withNamespace()

Attaches an additional namespace to a logger. Two behaviors, chosen automatically:

1. **Clog instance** — returns a fresh `Clog` whose `ns` is the *composed* namespace (parent joined with the new segment via `:`), inheriting the parent's config. `LogData.namespace` carries the composed string, so JSON output gets the full namespace in its `"namespace"` field.
2. **Any other logger** (e.g. native `console`, or a custom implementation) — returns a wrapper that prepends `[namespace]` as the first argument on each call.

In both cases, text rendering shows each segment in its own brackets (`[app] [module]`) so visible output is identical to pre-3.16 behavior.

```typescript
function withNamespace<T extends Logger>(logger: T, namespace: string): T & ((...args: any[]) => string)
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `logger` | `Logger` | Any console-compatible logger (clog, console, or custom) |
| `namespace` | `string` | Namespace segment to attach |

### Returns

- When `logger` is a clog instance: a new `Clog` (with readonly composed `.ns`, parent's config inherited).
- Otherwise: a wrapped logger with the same interface as the input plus a callable signature.

### Examples

```typescript
import { createClog, withNamespace } from "@marianmeres/clog";

// Clog wrapping — composes structurally
const clog = createClog("app");
const moduleLogger = withNamespace(clog, "module");
moduleLogger.log("hello");    // [app] [module] hello
moduleLogger.ns;              // "app:module"

// Native console — arg-prefix wrapper
const logger = withNamespace(console, "my-module");
logger.warn("warning");       // [my-module] warning

// Deep nesting composes further
const sub = withNamespace(moduleLogger, "sub");
sub.ns;                       // "app:module:sub"
sub.error("fail");            // [app] [module] [sub] fail

// Callable interface
moduleLogger("direct call");  // [app] [module] direct call

// Return value pattern works at any depth
throw new Error(moduleLogger.error("Something failed"));
```

### JSON output composition

```typescript
createClog.global.jsonOutput = true;
const clog = createClog("app");
const child = withNamespace(clog, "module");
child.log("hello");
// {"timestamp":"...","level":"INFO","namespace":"app:module","message":"hello"}
```

### Use Case: Dependency Injection

The primary use case is passing loggers to modules that want their own namespace while preserving the parent context:

```typescript
// app.ts
const appLog = createClog("app");
const authModule = new AuthModule(withNamespace(appLog, "auth"));
const dbModule = new DbModule(withNamespace(appLog, "db"));

// auth-module.ts
class AuthModule {
  constructor(private log: Logger) {}

  login(user: string) {
    this.log.log("Login attempt", { user });  // [app] [auth] Login attempt { user: "..." }
  }
}
```

---

## createLogForwarder()

Creates a log forwarder for batching and sending logs to remote services. Available from `@marianmeres/clog/forward`.

```typescript
import { createLogForwarder } from "@marianmeres/clog/forward";

function createLogForwarder(
  flusher: (logs: LogData[]) => Promise<boolean>,
  config?: LogForwarderConfig,
  autostart?: boolean
): LogForwarder
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `flusher` | `(logs: LogData[]) => Promise<boolean>` | - | Async function to send batched logs, returns `true` on success |
| `config` | `LogForwarderConfig` | `undefined` | BatchFlusher configuration options |
| `autostart` | `boolean` | `true` | Start interval-based flushing immediately |

### Config Options (LogForwarderConfig)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `flushIntervalMs` | `number` | `1000` | Auto-flush interval in milliseconds |
| `flushThreshold` | `number` | - | Flush immediately when buffer reaches this size |
| `maxBatchSize` | `number` | `100` | Maximum buffer size (oldest items discarded if exceeded) |

### Returns

A `LogForwarder` instance with the following interface:

| Member | Type | Description |
|--------|------|-------------|
| `hook` | `(data: LogData) => void` | Hook function to assign to `createClog.global.hook` |
| `add` | `(data: LogData) => void` | Add log entry to batch (alias for `hook`) |
| `flush` | `() => Promise<boolean>` | Flush current buffer immediately |
| `drain` | `() => Promise<boolean>` | Flush remaining items and stop interval |
| `start` | `() => void` | Start auto-flush interval |
| `stop` | `() => void` | Stop auto-flush interval |
| `reset` | `() => void` | Clear buffer and state |
| `dump` | `() => LogData[]` | Get current buffer contents |
| `configure` | `(config) => void` | Update configuration |
| `subscribe` | `(fn) => () => void` | Subscribe to state changes, returns unsubscribe |
| `size` | `number` | Current buffer size (readonly) |
| `isRunning` | `boolean` | Whether interval flushing is active (readonly) |
| `isFlushing` | `boolean` | Whether flush operation is in progress (readonly) |

### Example

```typescript
import { createClog } from "@marianmeres/clog";
import { createLogForwarder } from "@marianmeres/clog/forward";

const forwarder = createLogForwarder(
  async (logs) => {
    const res = await fetch("/api/logs", {
      method: "POST",
      body: JSON.stringify(logs)
    });
    return res.ok;
  },
  { flushIntervalMs: 5000, flushThreshold: 50, maxBatchSize: 1000 }
);

// Wire up to clog
createClog.global.hook = forwarder.hook;

// Monitor buffer state
forwarder.subscribe((state) => {
  if (state.size > 800) console.warn("Buffer getting full");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await forwarder.drain();
  process.exit(0);
});
```

---

## LEVEL_MAP

Standard log levels mapping based on syslog/RFC 5424.

```typescript
const LEVEL_MAP: {
  readonly debug: "DEBUG";
  readonly log: "INFO";
  readonly warn: "WARNING";
  readonly error: "ERROR";
}
```

Maps console-style method names to RFC 5424 severity level names:

| Console Method | RFC 5424 Level |
|----------------|----------------|
| `debug` | `"DEBUG"` |
| `log` | `"INFO"` |
| `warn` | `"WARNING"` |
| `error` | `"ERROR"` |

### Example

```typescript
import { LEVEL_MAP } from "@marianmeres/clog";

console.log(LEVEL_MAP.debug); // "DEBUG"
console.log(LEVEL_MAP.log);   // "INFO"
```

---

## stringifyValue()

Stringify a single value for logging output. Handles null, undefined, primitives, StyledText, and objects. Useful for custom writers that need to convert values to strings.

```typescript
function stringifyValue(arg: any): string
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `arg` | `any` | Any value to stringify |

### Returns

String representation of the value:
- `null` → `"null"`
- `undefined` → `"undefined"`
- primitives → `String(value)`
- StyledText → plain text content
- objects → `JSON.stringify(value)` (falls back to `String(value)` on error)

### Examples

```typescript
import { stringifyValue } from "@marianmeres/clog";

// Basic usage
stringifyValue(null);           // "null"
stringifyValue(undefined);      // "undefined"
stringifyValue(42);             // "42"
stringifyValue("hello");        // "hello"
stringifyValue({ a: 1 });       // '{"a":1}'
stringifyValue([1, 2, 3]);      // '[1,2,3]'

// In a custom writer
const customWriter: WriterFn = (data) => {
  const message = data.args.map(stringifyValue).join(" ");
  myLoggingService.send(message);
};

// With StyledText (extracts plain text)
import { green } from "@marianmeres/clog";
stringifyValue(green("OK"));    // "OK"
```

---

## formatStack()

Renders an array of raw stack frame lines into the same human-readable block the default writer appends to log output. Useful for custom writers that want to include stack traces consistently.

```typescript
function formatStack(lines: string[]): string
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `lines` | `string[]` | Stack frame lines (e.g. from `LogData.stack`) |

### Returns

A multi-line string beginning with `\n---\nStack:` followed by each indented frame.

### Example

```typescript
import { createClog, formatStack } from "@marianmeres/clog";

createClog.global.stacktrace = 5;
createClog.global.writer = (data) => {
  mySink({
    msg: data.args[0],
    stack: data.stack ? formatStack(data.stack) : undefined,
  });
};
```

---

## CLOG_SKIP

A globally-shared symbol used as a sentinel: return it from a hook to **suppress the writer** for that single log call. Any other return value is ignored.

```typescript
const CLOG_SKIP: unique symbol = Symbol.for("@marianmeres/clog-skip")
```

### Example

```typescript
import { createClog, CLOG_SKIP } from "@marianmeres/clog";

createClog.global.hook = (data) => {
  if (data.args[0] === "shhh") return CLOG_SKIP;  // dropped
};

const clog = createClog("app");
clog.log("shhh");   // returns "shhh" but does not reach any writer
clog.log("hello");  // normal output
```

---

## Color Functions

### colored()

Creates a styled text object that works with both `console.log` and `clog`.

```typescript
function colored(str: string, color?: string): StyledText
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `str` | `string` | - | The text to style |
| `color` | `string` | `"auto"` | CSS color string or `"auto"` for hash-based color |

#### Returns

A `StyledText` object that can be spread into `console.log` or passed directly to `clog`.

#### Examples

```typescript
import { colored } from "@marianmeres/clog";

// With console.log (spread syntax required)
console.log(...colored("hello", "red"));
console.log(...colored("auto colored", "auto"));

// With clog (direct pass - no spread needed)
const clog = createClog("app");
clog(colored("styled text", "blue"));

// Mixed with other arguments
clog("prefix", colored("styled", "green"), "suffix");

// Safe string concatenation (returns plain text)
console.log("Status: " + colored("OK", "green")); // "Status: OK"
```

---

### Color Shortcuts

Shorthand functions that return `StyledText` objects using safe hex colors optimized for both light and dark backgrounds.

```typescript
red(text: string): StyledText
green(text: string): StyledText
blue(text: string): StyledText
yellow(text: string): StyledText
orange(text: string): StyledText
pink(text: string): StyledText
purple(text: string): StyledText
magenta(text: string): StyledText
cyan(text: string): StyledText
teal(text: string): StyledText
gray(text: string): StyledText
grey(text: string): StyledText  // alias for gray
```

#### Examples

```typescript
import { createClog, red, green, blue, yellow } from "@marianmeres/clog";

const clog = createClog("app", { color: "auto" });

clog("Status:", green("OK"));
clog("Error:", red("Failed to connect"));
clog(blue("Info:"), "Processing complete in", yellow("12ms"));

// Works with console.log (spread syntax)
console.log(...pink("styled message"));
```

---

### SAFE_COLORS

Object containing safe hex color values optimized for readability on both light and dark backgrounds.

```typescript
const SAFE_COLORS: {
  readonly gray: "#969696";
  readonly grey: "#969696";
  readonly red: "#d26565";
  readonly orange: "#cba14d";
  readonly yellow: "#cba14d";
  readonly green: "#3dc73d";
  readonly teal: "#4dcba1";
  readonly cyan: "#4dcba1";
  readonly blue: "#67afd3";
  readonly purple: "#8e8ed4";
  readonly magenta: "#b080c8";
  readonly pink: "#be5b9d";
}
```

| Name | Hex | Notes |
|------|-----|-------|
| gray/grey | `#969696` | Neutral gray |
| red | `#d26565` | Muted red |
| orange | `#cba14d` | Warm orange |
| yellow | `#cba14d` | Same as orange (pure yellow too bright on light bg) |
| green | `#3dc73d` | Bright green |
| teal/cyan | `#4dcba1` | Blue-green |
| blue | `#67afd3` | Light blue |
| purple | `#8e8ed4` | Blue-purple |
| magenta | `#b080c8` | Pink-purple |
| pink | `#be5b9d` | Bright pink |

---

### autoColor()

Auto-picks a consistent color for a given string using a hash function. The same string always produces the same color.

```typescript
function autoColor(str: string): string
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `str` | `string` | The string to generate a color for (typically a namespace) |

#### Returns

A CSS hex color from the predefined palette.

#### Example

```typescript
import { autoColor } from "@marianmeres/clog";

const color = autoColor("my-namespace"); // Returns consistent hex color
```

---

## Types

### Clog

Callable Logger interface with namespace support.

```typescript
interface Clog extends Logger {
  (...args: any[]): string;      // Callable, proxies to log()
  readonly ns: string | false;   // Logger namespace
}
```

The `Clog` interface extends `Logger` and adds:
- **Callable signature**: Can be invoked directly as a function, which proxies to `log()`
- **`ns` property**: Readonly namespace of this logger instance

### Logger

Console-compatible logger interface.

```typescript
interface Logger {
  debug: (...args: any[]) => string;
  log: (...args: any[]) => string;
  warn: (...args: any[]) => string;
  error: (...args: any[]) => string;
}
```

All methods return the first argument as a string, enabling patterns like:

```typescript
throw new Error(clog.error("Something failed"));
```

### LogData

Normalized log data structure passed to writers and hooks.

```typescript
type LogData = {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  namespace: string | false;              // composed with ":" via withNamespace
  args: any[];                            // shallow clone of caller's args
  timestamp: string;                      // ISO 8601 format
  config?: ClogConfig;                    // Instance config (for custom writers)
  meta?: Record<string, unknown>;         // lazy: getMeta() invoked on first read
  stack?: string[];                       // raw frames, when stacktrace enabled
}
```

| Property | Type | Description |
|----------|------|-------------|
| `level` | `string` | RFC 5424 level name |
| `namespace` | `string \| false` | Logger namespace or `false`. Composed namespaces from `withNamespace` use `:` (e.g. `"app:module"`). |
| `args` | `any[]` | **Shallow clone** of the arguments passed to the log method. Hooks/writers can mutate this freely without affecting the caller. |
| `timestamp` | `string` | ISO 8601 formatted timestamp |
| `config` | `ClogConfig \| undefined` | Instance-level config (useful for custom writers to check settings) |
| `meta` | `Record<string, unknown> \| undefined` | Metadata from `getMeta()`. **Lazy**: the getter runs on first read and caches the result. If `getMeta()` throws, the exception is swallowed and this stays `undefined`. |
| `stack` | `string[] \| undefined` | Raw captured stack frames when `stacktrace` is enabled. Use `formatStack(lines)` to produce the same rendering as the default writer. |

### LogLevel

Log level type representing available console-style log methods.

```typescript
type LogLevel = "debug" | "log" | "warn" | "error"
```

### WriterFn

Writer function signature for custom log output handlers.

```typescript
type WriterFn = (data: LogData) => void
```

### Example

```typescript
const myWriter: WriterFn = (data) => {
  console.log(`[${data.level}] ${data.args.join(" ")}`);
};
```

### HookFn

Hook function signature for intercepting log calls.

```typescript
type HookFn = (data: LogData) => void | typeof CLOG_SKIP
```

Used for collecting, batching, analytics, or filtering. Hooks are called before writers. Return the [`CLOG_SKIP`](#clog_skip) symbol to suppress the writer for that single log call; any other return value is ignored.

**Transforming via mutation.** The `data` object passed to the hook is the same reference the writer receives next. Mutating it in place (e.g. prefixing `data.namespace`, redacting strings in `data.args`, augmenting `data.meta`) is a supported way to transform what the writer sees without replacing the writer. `data.args` is already a shallow clone of the caller's arguments, so mutating or replacing it is safe and does not affect the caller. A hook may both transform and return `CLOG_SKIP`.

```typescript
// Prefix the namespace — surfaces in text output and JSON "logger" field
createClog.global.hook = (data) => {
  if (data.namespace) data.namespace = `svc:${data.namespace}`;
};
```

### ClogConfig

Instance-level configuration options.

```typescript
interface ClogConfig {
  writer?: WriterFn;
  color?: string | null;
  debug?: boolean;
  stringify?: boolean;
  concat?: boolean;
  stacktrace?: boolean | number;
  jsonOutput?: boolean;
  jsonFieldNames?: JsonFieldNames;
  getMeta?: () => Record<string, unknown>;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `writer` | `WriterFn` | Custom writer for this instance (overridden by global writer) |
| `color` | `string \| null` | CSS color for namespace styling (browser/Deno only) |
| `debug` | `boolean` | When `false`, `.debug()` is a no-op (overrides global setting) |
| `stringify` | `boolean` | When `true`, JSON.stringify non-primitive args (overrides global setting) |
| `concat` | `boolean` | When `true`, concatenate all args into single string (overrides global setting). Concat always stringifies non-primitive args regardless of `stringify`. |
| `stacktrace` | `boolean \| number` | When enabled, capture call stack and expose via `LogData.stack` + render in output (overrides global). **Dev only!** |
| `jsonOutput` | `boolean` | When set, overrides `GlobalConfig.jsonOutput` for this instance. Added in v3.16. |
| `jsonFieldNames` | `JsonFieldNames` | Per-field rename map for JSON output. Per-key resolution: instance > global > default. Added in v3.18. See [JsonFieldNames](#jsonfieldnames). |
| `getMeta` | `() => Record<string, unknown>` | Function returning metadata to include in `LogData.meta` (overrides global). Lazy; throws are swallowed. |

### GlobalConfig

Global configuration options.

```typescript
interface GlobalConfig {
  hook?: HookFn;
  writer?: WriterFn;
  jsonOutput?: boolean;
  jsonFieldNames?: JsonFieldNames;
  debug?: boolean;
  stringify?: boolean;
  concat?: boolean;
  stacktrace?: boolean | number;
  getMeta?: () => Record<string, unknown>;
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `hook` | `HookFn` | `undefined` | Global hook called before every log. Return `CLOG_SKIP` to suppress the writer. |
| `writer` | `WriterFn` | `undefined` | Global writer overriding all instances |
| `jsonOutput` | `boolean` | `false` | Enable JSON output for server environments (per-instance override available via `ClogConfig.jsonOutput`) |
| `jsonFieldNames` | `JsonFieldNames` | `undefined` | Per-field rename map for JSON output (can be overridden per-instance per-key). Added in v3.18. See [JsonFieldNames](#jsonfieldnames). |
| `debug` | `boolean` | `undefined` | Global debug mode (can be overridden per-instance) |
| `stringify` | `boolean` | `undefined` | JSON.stringify non-primitive args (can be overridden per-instance) |
| `concat` | `boolean` | `undefined` | Concatenate all args into single string (can be overridden per-instance) |
| `stacktrace` | `boolean \| number` | `undefined` | Append call stack to output (can be overridden per-instance). **Dev only!** |
| `getMeta` | `() => Record<string, unknown>` | `undefined` | Function returning metadata to include in `LogData.meta` (can be overridden per-instance). Lazy; throws are swallowed. |

### JsonFieldKey

Conceptual identifiers for the top-level fields emitted in JSON output mode. Added in v3.18.

```typescript
type JsonFieldKey =
  | "timestamp"
  | "level"
  | "logger"
  | "message"
  | "meta"
  | "arg"
  | "stack";
```

The `arg` key is special — it's the **prefix** used for sequenced extra args (`arg_0`, `arg_1`, …). Renaming it via [JsonFieldNames](#jsonfieldnames) changes the prefix accordingly (e.g. `{ arg: "extra" }` → `extra_0`, `extra_1`, …).

### JsonFieldNames

Per-field rename map for JSON output. Added in v3.18.

```typescript
type JsonFieldNames = Partial<Record<JsonFieldKey, string>>;
```

Any key omitted falls back to the default name. Resolution is **per-key**: instance config > global config > default. Defaults are: `timestamp`, `level`, `logger`, `message`, `meta`, `arg`, `stack`.

#### Examples

```typescript
import { createClog, type JsonFieldNames } from "@marianmeres/clog";

// Restore the pre-3.18 "namespace" key:
createClog.global.jsonFieldNames = { logger: "namespace" };

// ECS-style names:
const ecs: JsonFieldNames = {
  timestamp: "@timestamp",
  level: "log.level",
  logger: "log.logger",
};
createClog.global.jsonFieldNames = ecs;

// Per-instance — only the keys you specify; others fall back to global / default:
const clog = createClog("api", {
  jsonOutput: true,
  jsonFieldNames: { logger: "service", arg: "extra" },
});
clog.log("hello", { a: 1 }, { b: 2 });
// {"timestamp":"...","level":"INFO","service":"api","message":"hello","extra_0":{"a":1},"extra_1":{"b":2}}
```

The `logger` field (under whatever name you choose) is **omitted** when the logger has no namespace (matches the pre-rename behavior).

### StyledText

Styled text object that works with both `console.log(...obj)` and `clog(obj)`.

```typescript
interface StyledText extends Iterable<string> {
  [CLOG_STYLED]: true;
  text: string;
  style: string;
  toString(): string;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `[CLOG_STYLED]` | `true` | Symbol marker for identifying styled text objects |
| `text` | `string` | The plain text content |
| `style` | `string` | CSS style string (e.g., `"color:#d26565"`) |
| `toString()` | `() => string` | Returns plain text for safe string concatenation |

The `Iterable<string>` implementation yields `["%ctext", "style"]` for spread syntax compatibility with `console.log`.

### ColorName

Union type of available color names in `SAFE_COLORS`.

```typescript
type ColorName = "gray" | "grey" | "red" | "orange" | "yellow" | "green"
               | "teal" | "cyan" | "blue" | "purple" | "magenta" | "pink"
```

### CLOG_STYLED

Symbol used to identify styled text objects created by `colored()`.

```typescript
const CLOG_STYLED: symbol = Symbol.for("@marianmeres/clog-styled")
```

Using `Symbol.for()` ensures the same symbol across module instances.

### Debug Precedence

Debug mode is determined in this order (highest to lowest precedence):

1. `config.debug` - Instance-level setting (if explicitly set)
2. `createClog.global.debug` - Global setting
3. Default - `true` (debug enabled)

---

## Output Formats

### Browser Output

```
[namespace] arg0 arg1 ...
```

With color enabled, uses `%c` CSS styling for the namespace.

### Server Output (Text Mode)

```
[2025-01-15T10:30:45.123Z] [INFO] [namespace] arg0 arg1 ...
```

### Server Output (JSON Mode)

When `createClog.global.jsonOutput = true` (or `ClogConfig.jsonOutput = true` on a specific instance):

```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "INFO",
  "logger": "api",
  "message": "Request received",
  "arg_0": { "method": "GET" }
}
```

Error stacks are preserved as `arg_N` properties containing the stack string.

The `logger` field is **omitted** when the logger has no namespace (rather than emitted as `false`). Same for `meta` when `getMeta` is unset or returns undefined. The optional `stack` field is present only when `stacktrace` is enabled.

**Field name customization (v3.18+):** Every top-level key shown above is renamable via [`jsonFieldNames`](#jsonfieldnames). The `arg` key is a prefix for sequenced extras (`arg_0`, `arg_1`, …). Pre-3.18, the namespace field was emitted as `"namespace"`; restore that with `createClog.global.jsonFieldNames = { logger: "namespace" }`.
