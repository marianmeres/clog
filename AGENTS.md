# AGENTS.md - Machine-Readable Project Documentation

## Package Identity

```yaml
name: "@marianmeres/clog"
version: "3.18.0"
license: "MIT"
author: "Marian Meres"
repository: "https://github.com/marianmeres/clog"
registry_npm: "https://www.npmjs.com/package/@marianmeres/clog"
registry_jsr: "https://jsr.io/@marianmeres/clog"
```

## Purpose

Universal console-compatible logger (~400 lines including JSDoc) with namespace support for browser, Node.js, and Deno. Provides structured logging for log aggregation tools with zero dependencies.

## Architecture

### File Structure

```
src/
├── mod.ts              # Entry point (re-exports from clog.ts and colors.ts)
├── clog.ts             # Main logger implementation
├── colors.ts           # Color utilities (colored, shortcuts, SAFE_COLORS)
└── forward.ts          # Log forwarder utility (batching/forwarding)
tests/
├── clog.test.ts        # Main test suite
├── forward.test.ts     # Log forwarder tests
└── deno-raw.ts         # Manual color examples
scripts/
└── build-npm.ts        # npm build script
.npm-dist/              # Generated npm distribution
deno.json               # Deno configuration, version, tasks
```

### Core Components

1. **Runtime Detection** (`detectRuntime`): Detects browser/node/deno/unknown. Result is cached on first call (runtime never changes in a single process).
2. **LEVEL_MAP**: RFC 5424 level mapping (debug→DEBUG, log→INFO, warn→WARNING, error→ERROR)
3. **createClog Factory**: Creates callable logger instances with namespace support. Each instance carries a non-enumerable `Symbol.for("@marianmeres/clog-instance")` marker so `withNamespace` can detect clog instances and compose structurally.
4. **Writers**: defaultWriter (environment-aware), colorWriter (browser/Deno %c styling). Both share `formatStack`, `renderNs`, `CONSOLE_METHOD` and the styled-args helpers.
5. **Global Config**: Truly global singleton using `Symbol.for()` + `globalThis` pattern (shared across multiple module instances)
6. **Color Utilities** (colors.ts): `colored()` function, color shortcuts (red, green, etc.), `SAFE_COLORS` hex palette, `StyledText` interface with Symbol-tagged objects for clog integration. `autoColor()` memoizes per-namespace results.
7. **Stack capture**: `captureStackLines()` filters internal frames by file-path match (`clog.ts`, `colors.ts`) rather than a magic frame count — survives wrappers like `withNamespace`.

### Data Flow

```
clog.log("msg")
  → _apply(level, args)
    → clone args (shallow) so hooks cannot mutate caller's array
    → capture stack lines if stacktrace enabled
    → build LogData {level, namespace, args, timestamp, stack}
    → attach lazy `.meta` getter if getMeta configured (swallows throws)
    → call GLOBAL.hook(data) if set
      → if hook returns CLOG_SKIP, suppress writer
    → select writer (global > instance > color > default)
    → call writer(data)
    → return firstArgAsString(args, config)  // matches logged form under stringify/concat
```

### Writer Precedence (highest to lowest)

1. `createClog.global.writer`
2. `config.writer` (instance)
3. `colorWriter` (if `config.color` set, browser/deno only)
4. `defaultWriter`

## Critical Conventions

1. No log level filtering - control at source, not runtime
2. All log methods return first argument as string (for `throw new Error(clog.error("msg"))`). Under `stringify` or `concat` modes, the returned string is the JSON-rendered form so it matches what was logged.
3. Console-compatible API - can replace `console` with any `Logger`
4. Global config uses `Symbol.for()` + `globalThis` for true global state
5. Writer precedence: global.writer > config.writer > colorWriter > defaultWriter
6. Config precedence: instance config > global config > defaults
7. Colors work in browser/Deno only (use %c formatting)
8. `LogData.args` is a *shallow clone* of the caller's arguments — hooks/writers may mutate it without affecting the caller
9. `LogData.meta` is a lazy getter: `getMeta()` runs only when a consumer reads `.meta`, exactly once, and its exceptions are swallowed (meta becomes `undefined`)
10. `withNamespace` composes namespaces structurally: `withNamespace(createClog("app"), "module").ns === "app:module"`. Text output splits on `:` and renders each segment in its own brackets (`[app] [module]`). JSON output uses the composed string as-is in the `namespace` field.
11. Stack capture lives in `_apply` (not the writers), so custom writers receive `LogData.stack: string[] | undefined`. Use the exported `formatStack()` to produce the same rendering as the default writer.
12. A hook returning `CLOG_SKIP` suppresses the writer for that call; all other return values are ignored.
13. The hook receives the same `data` reference passed to the writer next, so **mutating `data` in the hook is a supported transform mechanism** (e.g. prefixing `namespace`, redacting `args`). `args` is already a shallow clone, so mutating it is safe.

## Before Making Changes

- [ ] Read existing code patterns in [src/clog.ts](src/clog.ts)
- [ ] Run tests: `deno test`
- [ ] Check type definitions match implementation
- [ ] Update tests for any API changes
- [ ] Update AGENTS.md if public API changes

## Public API

### Exports (from src/mod.ts)

**From clog.ts:**

| Export | Type | Description |
|--------|------|-------------|
| `createClog` | Function | Factory for creating logger instances |
| `createClog.global` | GlobalConfig | Global configuration object |
| `createClog.reset` | Function | Reset global config to defaults |
| `createNoopClog` | Function | Factory for no-op logger instances (for testing) |
| `withNamespace` | Function | Wrap logger: composes structurally for clog instances, arg-prefix for others |
| `stringifyValue` | Function | Stringify a single value for logging (for custom writers) |
| `formatStack` | Function | Render an array of stack frame lines the same way the default writer does |
| `CLOG_SKIP` | Symbol | Sentinel — hooks return this to suppress the writer for a single log call |
| `LEVEL_MAP` | Const Object | RFC 5424 level mapping |
| `LogLevel` | Type | `"debug" \| "log" \| "warn" \| "error"` |
| `LogData` | Type | Normalized log data structure (now includes optional `stack: string[]`) |
| `WriterFn` | Type | Writer function signature |
| `HookFn` | Type | `(data: LogData) => void \| typeof CLOG_SKIP` |
| `Logger` | Interface | Console-compatible logger interface |
| `Clog` | Interface | Callable Logger with namespace |
| `ClogConfig` | Interface | Instance configuration options (now includes `jsonOutput`, `jsonFieldNames`) |
| `GlobalConfig` | Interface | Global configuration options (now includes `jsonFieldNames`) |
| `JsonFieldKey` | Type | Conceptual JSON field identifier (`"timestamp" \| "level" \| "logger" \| "message" \| "meta" \| "arg" \| "stack"`) |
| `JsonFieldNames` | Type | `Partial<Record<JsonFieldKey, string>>` — per-field rename map for JSON output |

**From colors.ts:**

| Export | Type | Description |
|--------|------|-------------|
| `colored` | Function | Creates StyledText object for console styling |
| `autoColor` | Function | Hash-based color picker for consistent coloring |
| `CLOG_STYLED` | Symbol | Marker symbol for StyledText identification |
| `StyledText` | Interface | Styled text object (iterable, toString) |
| `SAFE_COLORS` | Const Object | Safe hex color palette for light/dark backgrounds |
| `ColorName` | Type | Union of SAFE_COLORS keys |
| `red`, `green`, `blue`, `yellow`, `orange`, `pink`, `purple`, `magenta`, `cyan`, `teal`, `gray`, `grey` | Functions | Color shortcut functions returning StyledText |

**From forward.ts (import from `@marianmeres/clog/forward`):**

| Export | Type | Description |
|--------|------|-------------|
| `createLogForwarder` | Function | Factory for log batching/forwarding instances |
| `LogForwarder` | Interface | Log forwarder instance interface |
| `LogForwarderConfig` | Type | Configuration options (wraps BatchFlusherConfig) |
| `LogFlusherFn` | Type | Flusher function signature |

### Function Signatures

```typescript
function createClog(namespace?: string | false, config?: ClogConfig): Clog

createClog.global: GlobalConfig
createClog.reset: () => void

// Widened from `string | null` to also accept `false` for symmetry with createClog.
// Any falsy value still disables the namespace.
function createNoopClog(namespace?: string | false | null): Clog

// When `logger` is a clog instance, returns a fresh Clog whose `.ns` is
// the composed namespace ("parent:child") with parent's config inherited.
// When `logger` is any other logger (e.g. native console), returns a wrapper
// that prepends `[namespace]` as an arg on each call.
function withNamespace<T extends Logger>(logger: T, namespace: string): T & ((...args: any[]) => string)

function stringifyValue(arg: any): string

function formatStack(lines: string[]): string

const CLOG_SKIP: unique symbol;  // hook return sentinel

// From @marianmeres/clog/forward
function createLogForwarder(
  flusher: LogFlusherFn,
  config?: LogForwarderConfig,
  autostart?: boolean
): LogForwarder
```

### Type Definitions

```typescript
type LogLevel = "debug" | "log" | "warn" | "error";

type LogData = {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  namespace: string | false;        // composed with ":" when via withNamespace
  args: any[];                      // shallow clone of caller's args
  timestamp: string;                // ISO 8601
  config?: ClogConfig;              // Instance config (for custom writers)
  meta?: Record<string, unknown>;   // Lazy: getMeta invoked on first .meta read (throws swallowed)
  stack?: string[];                 // Raw stack frames when stacktrace is enabled
};

type WriterFn = (data: LogData) => void;
type HookFn = (data: LogData) => void | typeof CLOG_SKIP;

interface Logger {
  debug: (...args: any[]) => string;
  log: (...args: any[]) => string;
  warn: (...args: any[]) => string;
  error: (...args: any[]) => string;
}

interface Clog extends Logger {
  (...args: any[]): string;
  readonly ns: string | false;
}

interface ClogConfig {
  writer?: WriterFn;
  color?: string | null;
  debug?: boolean;                  // when false, .debug() is a no-op (overrides global)
  stringify?: boolean;              // when true, JSON.stringify non-primitive args
  concat?: boolean;                 // when true, concatenate all args into single string
  stacktrace?: boolean | number;    // when enabled, capture call stack (dev only!)
  jsonOutput?: boolean;             // when set, overrides global.jsonOutput for this instance
  jsonFieldNames?: JsonFieldNames;  // per-field rename map for JSON output (overrides global per-key)
  getMeta?: () => Record<string, unknown>; // metadata injection (overrides global)
}

interface GlobalConfig {
  hook?: HookFn;
  writer?: WriterFn;
  jsonOutput?: boolean;
  jsonFieldNames?: JsonFieldNames; // per-field rename map for JSON output (can be overridden per-instance per-key)
  debug?: boolean;              // when false, .debug() is a no-op (can be overridden per-instance)
  stringify?: boolean;          // when true, JSON.stringify non-primitive args
  concat?: boolean;             // when true, concatenate all args into single string
  stacktrace?: boolean | number; // when enabled, append call stack (dev only!)
  getMeta?: () => Record<string, unknown>; // metadata injection (can be overridden per-instance)
}

// Conceptual identifiers for top-level JSON output fields. The `arg` key is a
// prefix for sequenced extra args (`arg_0`, `arg_1`, …) — renaming it to
// `"extra"` produces `extra_0`, `extra_1`, …
type JsonFieldKey =
  | "timestamp" | "level" | "logger" | "message" | "meta" | "arg" | "stack";
type JsonFieldNames = Partial<Record<JsonFieldKey, string>>;

// From colors.ts
const CLOG_STYLED: unique symbol = Symbol.for("@marianmeres/clog-styled");

interface StyledText extends Iterable<string> {
  [CLOG_STYLED]: true;
  text: string;
  style: string;
  toString(): string;
}

type ColorName = keyof typeof SAFE_COLORS;
// "gray" | "grey" | "red" | "orange" | "yellow" | "green" | "teal" | "cyan" | "blue" | "purple" | "magenta" | "pink"

// From @marianmeres/clog/forward
type LogFlusherFn = (logs: LogData[]) => Promise<boolean>;
type LogForwarderConfig = Partial<BatchFlusherConfig>; // from @marianmeres/batch

interface LogForwarder {
  hook: (data: LogData) => void;
  add: (data: LogData) => void;
  flush: () => Promise<boolean>;
  drain: () => Promise<boolean>;
  start: () => void;
  stop: () => void;
  reset: () => void;
  dump: () => LogData[];
  configure: (config: LogForwarderConfig) => void;
  subscribe: (fn: (state: BatchFlusherState) => void) => () => void;
  readonly size: number;
  readonly isRunning: boolean;
  readonly isFlushing: boolean;
}
```

## Output Formats

### Browser Mode

```
[namespace] arg0 arg1 ...
```

### Server Text Mode (jsonOutput=false)

```
[ISO-timestamp] [LEVEL] [namespace] arg0 arg1 ...
```

### Server JSON Mode (jsonOutput=true)

```json
{"timestamp":"ISO","level":"LEVEL","logger":"ns","message":"arg0","arg_0":"arg1","arg_1":"arg2"}
```

Default field names: `timestamp`, `level`, `logger`, `message`, `meta`, `stack`, plus the `arg` prefix for sequenced extras (`arg_0`, `arg_1`, …). Any of them are renameable via `ClogConfig.jsonFieldNames` / `GlobalConfig.jsonFieldNames` (per-key resolution: instance > global > default). The `logger` field (under whatever name) is omitted when the logger has no namespace.

Error stacks are preserved at `arg_N` (or `<arg-prefix>_N` if renamed) with the stack string value.

## Commands

| Task | Command |
|------|---------|
| Run tests | `deno test` |
| Run tests (watch) | `deno test --watch` |
| Build npm package | `deno run -A scripts/build-npm.ts` |
| Build and publish | `deno task npm:publish` |

## Dependencies

### Production
- `@marianmeres/batch` - Batch processing (used by forward.ts)

### Development
- `@std/assert` - Testing assertions
- `@std/fs` - File system utilities (build script)
- `@std/path` - Path utilities (build script)
- `@marianmeres/npmbuild` - npm build helper

## Test Coverage

132 tests covering:
- Callable interface
- All log levels (debug, log, warn, error)
- Namespace handling (string, false, undefined)
- Return value pattern (first arg as string)
- Global hooks and writers
- Instance writers
- Writer precedence (global > instance)
- Hook execution order (before writer)
- Hook data mutation as transform mechanism (5 tests: namespace prefix → text and JSON outputs, args replacement isolated from caller, meta augmentation surfacing in writer, mutation + CLOG_SKIP suppresses writer)
- JSON and text output formats (incl. `jsonFieldNames` rename map: instance/global precedence, `arg` prefix, `logger` omission when namespace is `false`, all 7 renamable keys, `reset()` clearing global)
- Error stack preservation in JSON
- Color configuration
- Configuration reset
- Readonly namespace property
- Multiple instances
- Batching pattern
- Debug mode (instance and global)
- Debug precedence (instance > global > default)
- Stringify mode (9 tests: global/instance flags, precedence, JSON output mode, circular refs)
- Concat mode (9 tests: global/instance flags, precedence, single string output, all levels)
- Stacktrace mode (9 tests: global/instance flags, precedence, frame limits, JSON output, concat mode)
- getMeta mode (9 tests: global/instance config, override precedence, hook/writer access, JSON output, all log levels)
- withNamespace wrapper (9 tests: basic wrapping, callable interface, all log levels, return values, throw pattern, deep nesting, console wrapping, debug inheritance)
- createNoopClog (7 tests: return values, callable interface, no console output, no hook triggers, namespace property, readonly namespace, throw pattern)
- Regressions (25 tests: B1 throwing getMeta, B2 return value under stringify/concat, B3 structural withNamespace composition + JSON output, B4 stack capture through wrappers, D2 arg cloning, D4 instance jsonOutput override, D7 namespace omission in JSON when false, D10 lazy getMeta, I1 autoColor memoization, I4 CLOG_SKIP sentinel)

## Design Principles

1. **No log level filtering** - Control at source, not runtime
2. **No enable/disable switches** - Simplicity over configurability
3. **Console-compatible** - Drop-in replacement for console methods
4. **Environment-agnostic** - One API for browser/Node/Deno
5. **Return value pattern** - All methods return first arg as string for `throw new Error(clog.error("msg"))`
6. **Zero dependencies** - No runtime dependencies
7. **Truly global config** - Uses `Symbol.for()` + `globalThis` to ensure global config is shared across multiple bundled copies

## Common Patterns

### Error Throwing

```typescript
throw new Error(clog.error("Something failed"));
```

### Log Forwarding (Recommended)

```typescript
import { createLogForwarder } from "@marianmeres/clog/forward";

const forwarder = createLogForwarder(
  async (logs) => {
    await fetch("/api/logs", { method: "POST", body: JSON.stringify(logs) });
    return true;
  },
  { flushIntervalMs: 5000, flushThreshold: 50, maxBatchSize: 1000 }
);

createClog.global.hook = forwarder.hook;

// Graceful shutdown
process.on("SIGTERM", async () => {
  await forwarder.drain();
  process.exit(0);
});
```

### Manual Log Batching

```typescript
const batch: LogData[] = [];
createClog.global.hook = (data) => {
  batch.push(data);
  if (batch.length >= 100) {
    sendToServer(batch);
    batch.length = 0;
  }
};
```

### Custom Output

```typescript
createClog.global.writer = (data) => sendToExternalService(data);
```

### Renaming JSON Output Fields (no custom writer needed)

```typescript
// Restore the pre-3.18 "namespace" key:
createClog.global.jsonFieldNames = { logger: "namespace" };

// ECS-style:
createClog.global.jsonFieldNames = {
  timestamp: "@timestamp",
  level: "log.level",
  logger: "log.logger",
};

// Per-instance (only the keys you specify; others fall back per-key to global / default):
const clog = createClog("api", {
  jsonOutput: true,
  jsonFieldNames: { logger: "service", arg: "extra" }, // arg becomes the prefix → extra_0, extra_1
});
```

Renamable keys: `timestamp`, `level`, `logger`, `message`, `meta`, `arg` (prefix), `stack`. The `logger` field is still omitted when the logger has no namespace, regardless of rename.

### Module Namespacing

```typescript
const authLog = createClog("auth");
const apiLog = createClog("api");
const dbLog = createClog("db");
```

### Nested Namespaces

```typescript
// Wrap a clog instance: composes structurally (ns = "app:module")
const appLog = createClog("app");
const moduleLog = withNamespace(appLog, "module");
moduleLog.log("hello");          // [app] [module] hello
moduleLog.ns;                    // "app:module"
// JSON output: {"namespace":"app:module","message":"hello",...}

// Deep nesting
const subLog = withNamespace(moduleLog, "sub");
subLog.ns;                       // "app:module:sub"
subLog.error("fail");            // [app] [module] [sub] fail

// Works with native console (arg-prefix wrapper)
const consoleLog = withNamespace(console, "my-module");

// Dependency injection pattern
class AuthService {
  constructor(private log: Logger) {}
  login() { this.log.log("Login"); }  // [app] [auth] Login
}
const authService = new AuthService(withNamespace(appLog, "auth"));
```

### Suppressing individual logs via a hook

```typescript
import { createClog, CLOG_SKIP } from "@marianmeres/clog";

createClog.global.hook = (data) => {
  if (data.args[0] === "suppress-me") return CLOG_SKIP;  // writer is skipped
  if (isNoisy(data)) return CLOG_SKIP;
};
```

### Transforming log data via a hook

The hook receives the *same* `data` reference the writer gets next, so mutating it in place is a supported way to transform what the writer sees — no need to replace the writer.

```typescript
// Prefix the namespace (becomes the JSON "logger" field value)
createClog.global.hook = (data) => {
  if (data.namespace) data.namespace = `svc:${data.namespace}`;
};

// Redact sensitive args; data.args is already a shallow clone so this
// is safe and does not affect the caller's array.
createClog.global.hook = (data) => {
  data.args = data.args.map((a) =>
    typeof a === "string" ? a.replace(/token=\S+/g, "token=***") : a,
  );
};
```

A hook can both transform *and* return `CLOG_SKIP`. Non-`CLOG_SKIP` return values are ignored; the transform takes effect via the mutation, not the return value.

### Custom writer consuming `data.stack`

```typescript
import { createClog, formatStack } from "@marianmeres/clog";

createClog.global.writer = (data) => {
  send({
    level: data.level,
    ns: data.namespace,
    msg: data.args[0],
    stack: data.stack ? formatStack(data.stack) : undefined,
  });
};
createClog.global.stacktrace = 10;   // capture up to 10 frames
```

### Debug Mode

```typescript
// Global: disable debug in production
createClog.global.debug = process.env.NODE_ENV !== "production";

// Per-instance: override global setting
const verboseLog = createClog("verbose", { debug: true }); // always debug
const quietLog = createClog("quiet", { debug: false });    // never debug
```

### Stringify Mode

```typescript
// JSON.stringify non-primitive arguments
createClog.global.stringify = true;

const clog = createClog("api");
clog.log("data", { user: "john" }, [1, 2, 3]);
// Output: [timestamp] [INFO] [api] data {"user":"john"} [1,2,3]

// Per-instance
const logWithStringify = createClog("app", { stringify: true });
```

### Concat Mode

```typescript
// Concatenate all args into single string (also enables stringify)
createClog.global.concat = true;

const clog = createClog("x");
clog(1, { hey: "ho" });
// Output: [timestamp] [INFO] [x] 1 {"hey":"ho"}
// Console receives exactly ONE string argument

// Per-instance
const flatLog = createClog("app", { concat: true });
```

### Stacktrace Mode (Dev Only!)

```typescript
// WARNING: Not for production - has performance overhead!
// Append call stack trace to output
createClog.global.stacktrace = true;

const clog = createClog("debug");
clog.log("Where am I?");
// Output includes stack trace showing call site

// Limit to N frames
createClog.global.stacktrace = 3;

// Per-instance
const debugLog = createClog("debug", { stacktrace: true });
```

### Metadata Injection (getMeta)

```typescript
// Global: inject metadata into all logs
createClog.global.getMeta = () => ({
  userId: getCurrentUserId(),
  requestId: getRequestId(),
  env: process.env.NODE_ENV
});

// Per-instance: override global getMeta
const apiLog = createClog("api", {
  getMeta: () => ({ traceId: getTraceId() })
});

// Access metadata in hook for log collection
createClog.global.hook = (data) => {
  sendToAnalytics({
    ...data,
    meta: data.meta  // { userId: "...", requestId: "..." }
  });
};

// Access metadata in custom writer
const clog = createClog("app", {
  getMeta: () => ({ requestId: "req-123" }),
  writer: (data) => {
    myLogSystem.write({ ...data, meta: data.meta });
  }
});
```

### Testing

```typescript
// Clean state between tests
beforeEach(() => {
  createClog.reset();
});

// Capture logs for assertions
const captured: LogData[] = [];
createClog.global.hook = (data) => captured.push(data);

// No-op logger for silent testing
const clog = createNoopClog("test");
clog.log("silent");  // returns "silent", outputs nothing
```

### Colored Output

```typescript
import { createClog, red, green, blue, yellow, colored } from "@marianmeres/clog";

const clog = createClog("app", { color: "auto" });

// Color shortcuts
clog("Status:", green("OK"));
clog("Error:", red("Failed"));
clog(blue("Info:"), "Processing in", yellow("12ms"));

// Custom colors
clog(colored("Custom", "#ff6600"));

// Works with console.log (spread syntax)
console.log(...red("styled message"));

// Safe string concatenation (returns plain text)
const msg = "Status: " + green("OK"); // "Status: OK"
```

## Modification Guide

### Add New Log Level

1. Add to `LEVEL_MAP` in [src/clog.ts](src/clog.ts)
2. Update `LogLevel` type (auto-derived from LEVEL_MAP)
3. Add method to `Logger` interface
4. Add method assignment in `createClog` factory
5. Update console method mapping in `defaultWriter` and `colorWriter`
6. Add tests

### Modify Output Format

- Text format: Edit `defaultWriter` function (non-jsonOutput branch)
- JSON format: Edit `defaultWriter` function (jsonOutput branch). Top-level field names are looked up through the merged `DEFAULT_JSON_FIELD_NAMES` + global + instance `jsonFieldNames`, so consumers can already rename any of them without touching the writer. Add a new conceptual key here only if you're emitting a *new* field — otherwise prefer renaming via `jsonFieldNames`.
- Color format: Edit `colorWriter` function

### Add Runtime Support

1. Update `_detectRuntime()` detection logic
2. Update `defaultWriter` for runtime-specific behavior
3. Update `colorWriter` if color support differs

## Version History

| Version | Changes |
|---------|---------|
| 3.18.0 | JSON output: default `"namespace"` field renamed to `"logger"` (matches OTel/ECS/Datadog conventions); added `jsonFieldNames` (instance + global) for per-field renames of all JSON output keys (`timestamp`, `level`, `logger`, `message`, `meta`, `arg`, `stack`). See "Behavior changes in v3.18" below. |
| 3.16.0 | Correctness pass: throwing `getMeta` no longer crashes logs; return value matches logged form under `stringify`/`concat`; `withNamespace` composes structurally for clog instances; stack capture survives wrappers; added `CLOG_SKIP` + instance `jsonOutput` + `formatStack`. See "Behavior changes in v3.16" below. |
| 3.2.x | JSDoc improvements, documentation updates |
| 3.2.0 | Color support for Deno |
| 3.1.0 | Callable support, type improvements |
| 3.0.0 | Major refactor, simplified API |

### Behavior changes in v3.18

| Area | Before | After | BC risk |
|------|--------|-------|---------|
| JSON output: namespace field name | `"namespace"` | `"logger"` (matches OTel `logger.name`, ECS `log.logger`, Datadog) | Medium — downstream parsers grepping the literal `"namespace"` field break. Restore in one line: `createClog.global.jsonFieldNames = { logger: "namespace" }`. Visible text output and `LogData.namespace` (the type field) are unchanged. |
| `ClogConfig.jsonFieldNames` / `GlobalConfig.jsonFieldNames` | did not exist | `Partial<Record<JsonFieldKey, string>>` — per-key rename map for all JSON output keys (`timestamp`, `level`, `logger`, `message`, `meta`, `arg`, `stack`). Per-key resolution: instance > global > default. The `arg` key is the prefix for sequenced extras (`arg_0`, `arg_1`, …). | None — additive. |

### Behavior changes in v3.16

**No API removals.** All existing names and signatures still work. The following behaviors changed:

| Area | Before | After | BC risk |
|------|--------|-------|---------|
| `clog.log(obj)` return value under `stringify: true` or `concat: true` | `"[object Object]"` | `JSON.stringify(obj)` (matches what was logged) | Medium — code that relied on the old `"[object Object]"` return breaks. The new behavior is what the docs promised. |
| `withNamespace(clog, "child")` → `LogData.namespace` | parent's ns only; child went into `args[0]` as `"[child]"` | composed ns string (`"parent:child"`); child no longer appears in args | High for JSON-output consumers — JSON `namespace` field now carries the composed value and `message` contains the real first arg. (Before, `message` was `"[child]"` and the real message was shifted to `arg_0`.) |
| `withNamespace(clog, "child")` text output | `[parent] [child] msg` (because `[child]` was an arg) | `[parent] [child] msg` (renderer splits composed ns on `:`) | Low — visible format is identical. |
| `withNamespace` return type | closure wrapping the parent | a new `createClog`-produced Clog when wrapping a clog instance (native-console path unchanged) | Low — still satisfies the declared `T & callable` type. Users who held an identity reference to the wrapper expecting pointer equality with the parent now see distinct objects. |
| `LogData.args` | reference to caller's array | shallow clone of caller's array | Low — hooks/writers that *mutated* `data.args` to affect the caller must switch to returning `CLOG_SKIP` + re-logging, or accept that mutations now stay local. |
| `LogData.meta` | eagerly computed every log; `getMeta` throws propagated | lazy getter (computed once on first read); throws are swallowed | Low — consumers that check `"meta" in data` will still see the property (defined via `Object.defineProperty`). Consumers that depended on eager failure of a broken `getMeta` lose that signal. |
| JSON output when `namespace === false` | `{"namespace": false, ...}` | `namespace` field omitted | Medium — downstream parsers expecting the key to always exist. Mirrors existing handling of `meta`. |
| `HookFn` return type | `void` (any return ignored) | `void \| typeof CLOG_SKIP` (CLOG_SKIP suppresses writer) | Low — hooks accidentally returning `false`/other values still work; only `CLOG_SKIP` is meaningful. |
| `createNoopClog` parameter type | `string \| null` | `string \| false \| null` | None — widening only. |
| `ClogConfig.jsonOutput` | did not exist | added (overrides `GlobalConfig.jsonOutput` per-instance) | None — additive. |
| Stack capture site | inside the writer | inside `_apply`; custom writers receive `LogData.stack: string[] \| undefined` | None — additive for custom writers; default and color writers still render identically. |
| Stack frame filtering | skipped a fixed 5 frames | skips by file-path match (`clog.ts`, `colors.ts`) | Low — one more frame is now correctly preserved when calling through `withNamespace` or custom wrappers. Users pinning on specific frame counts in tests may see one more useful frame. |

### Breaking Changes in v3.0

Removed:
- `createLogger()` - Use `createClog()`
- `createClogStr()` - No longer needed
- `info()` method - Use `log()` (maps to INFO)
- `DISABLED` flag - Use custom writer or remove calls
- `CONFIG` object - Simplified to `global.jsonOutput`
- `COLORS` flag - Use per-instance `config.color`
- Chainable color API - Use config object
- Time/dateTime options - Always use timestamps in server mode

## File Locations

| Concern | File |
|---------|------|
| Main logger implementation | [src/clog.ts](src/clog.ts) |
| Color utilities | [src/colors.ts](src/colors.ts) |
| Log forwarder | [src/forward.ts](src/forward.ts) |
| Entry point | [src/mod.ts](src/mod.ts) |
| Test helpers | [tests/_helpers.ts](tests/_helpers.ts) |
| Basic tests | [tests/basic.test.ts](tests/basic.test.ts) |
| Global config tests | [tests/global-config.test.ts](tests/global-config.test.ts) |
| JSON output tests | [tests/json-output.test.ts](tests/json-output.test.ts) |
| Debug mode tests | [tests/debug-mode.test.ts](tests/debug-mode.test.ts) |
| Stringify tests | [tests/stringify.test.ts](tests/stringify.test.ts) |
| Concat tests | [tests/concat.test.ts](tests/concat.test.ts) |
| Stacktrace tests | [tests/stacktrace.test.ts](tests/stacktrace.test.ts) |
| getMeta tests | [tests/get-meta.test.ts](tests/get-meta.test.ts) |
| withNamespace tests | [tests/with-namespace.test.ts](tests/with-namespace.test.ts) |
| createNoopClog tests | [tests/noop-clog.test.ts](tests/noop-clog.test.ts) |
| Regression tests (v3.16) | [tests/regressions.test.ts](tests/regressions.test.ts) |
| Forwarder tests | [tests/forward.test.ts](tests/forward.test.ts) |
| Color examples | [tests/deno-raw.ts](tests/deno-raw.ts) |
| Build script | [scripts/build-npm.ts](scripts/build-npm.ts) |
| Package config | [deno.json](deno.json) |
| Human documentation | [README.md](README.md) |
| API documentation | [API.md](API.md) |
| Machine documentation | [AGENTS.md](AGENTS.md) |
| AI assistant redirect | [CLAUDE.md](CLAUDE.md) |
