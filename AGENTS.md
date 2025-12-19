# AGENTS.md - Machine-Readable Project Documentation

## Package Identity

```yaml
name: "@marianmeres/clog"
version: "3.2.3"
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

1. **Runtime Detection** (`_detectRuntime`): Detects browser/node/deno/unknown
2. **LEVEL_MAP**: RFC 5424 level mapping (debug→DEBUG, log→INFO, warn→WARNING, error→ERROR)
3. **createClog Factory**: Creates callable logger instances with namespace support
4. **Writers**: defaultWriter (environment-aware), colorWriter (browser/Deno %c styling)
5. **Global Config**: Truly global singleton using `Symbol.for()` + `globalThis` pattern (shared across multiple module instances)
6. **Color Utilities** (colors.ts): `colored()` function, color shortcuts (red, green, etc.), `SAFE_COLORS` hex palette, `StyledText` interface with Symbol-tagged objects for clog integration

### Data Flow

```
clog.log("msg")
  → _apply(level, args)
    → create LogData {level, namespace, args, timestamp}
    → call GLOBAL.hook(data) if set
    → select writer (global > instance > color > default)
    → call writer(data)
    → return String(args[0])
```

### Writer Precedence (highest to lowest)

1. `createClog.global.writer`
2. `config.writer` (instance)
3. `colorWriter` (if `config.color` set, browser/deno only)
4. `defaultWriter`

## Public API

### Exports (from src/mod.ts)

**From clog.ts:**

| Export | Type | Description |
|--------|------|-------------|
| `createClog` | Function | Factory for creating logger instances |
| `createClog.global` | GlobalConfig | Global configuration object |
| `createClog.reset` | Function | Reset global config to defaults |
| `createNoopClog` | Function | Factory for no-op logger instances (for testing) |
| `withNamespace` | Function | Wrap logger with additional namespace prefix |
| `LEVEL_MAP` | Const Object | RFC 5424 level mapping |
| `LogLevel` | Type | `"debug" \| "log" \| "warn" \| "error"` |
| `LogData` | Type | Normalized log data structure |
| `WriterFn` | Type | Writer function signature |
| `HookFn` | Type | Hook function signature (alias of WriterFn) |
| `Logger` | Interface | Console-compatible logger interface |
| `Clog` | Interface | Callable Logger with namespace |
| `ClogConfig` | Interface | Instance configuration options |
| `GlobalConfig` | Interface | Global configuration options |

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

function createNoopClog(namespace?: string | null): Clog

function withNamespace<T extends Logger>(logger: T, namespace: string): T & ((...args: any[]) => string)

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
  namespace: string | false;
  args: any[];
  timestamp: string; // ISO 8601
  config?: ClogConfig; // Instance config (for custom writers)
  meta?: Record<string, unknown>; // Metadata from getMeta()
};

type WriterFn = (data: LogData) => void;
type HookFn = WriterFn;

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
  debug?: boolean;              // when false, .debug() is a no-op (overrides global)
  stringify?: boolean;          // when true, JSON.stringify non-primitive args
  concat?: boolean;             // when true, concatenate all args into single string
  stacktrace?: boolean | number; // when enabled, append call stack (dev only!)
  getMeta?: () => Record<string, unknown>; // metadata injection (overrides global)
}

interface GlobalConfig {
  hook?: HookFn;
  writer?: WriterFn;
  jsonOutput?: boolean;
  debug?: boolean;              // when false, .debug() is a no-op (can be overridden per-instance)
  stringify?: boolean;          // when true, JSON.stringify non-primitive args
  concat?: boolean;             // when true, concatenate all args into single string
  stacktrace?: boolean | number; // when enabled, append call stack (dev only!)
  getMeta?: () => Record<string, unknown>; // metadata injection (can be overridden per-instance)
}

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
{"timestamp":"ISO","level":"LEVEL","namespace":"ns","message":"arg0","arg_0":"arg1","arg_1":"arg2"}
```

Error stacks preserved as `arg_N` with stack string value.

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

94 tests covering:
- Callable interface
- All log levels (debug, log, warn, error)
- Namespace handling (string, false, undefined)
- Return value pattern (first arg as string)
- Global hooks and writers
- Instance writers
- Writer precedence (global > instance)
- Hook execution order (before writer)
- JSON and text output formats
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

### Module Namespacing

```typescript
const authLog = createClog("auth");
const apiLog = createClog("api");
const dbLog = createClog("db");
```

### Nested Namespaces

```typescript
// Wrap any console-compatible logger with additional namespace
const appLog = createClog("app");
const moduleLog = withNamespace(appLog, "module");
moduleLog.log("hello");  // [app] [module] hello

// Deep nesting
const subLog = withNamespace(moduleLog, "sub");
subLog.error("fail");    // [app] [module] [sub] fail

// Works with native console
const consoleLog = withNamespace(console, "my-module");

// Dependency injection pattern
class AuthService {
  constructor(private log: Logger) {}
  login() { this.log.log("Login"); }  // [app] [auth] Login
}
const authService = new AuthService(withNamespace(appLog, "auth"));
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
- JSON format: Edit `defaultWriter` function (jsonOutput branch)
- Color format: Edit `colorWriter` function

### Add Runtime Support

1. Update `_detectRuntime()` detection logic
2. Update `defaultWriter` for runtime-specific behavior
3. Update `colorWriter` if color support differs

## Version History

| Version | Changes |
|---------|---------|
| 3.2.x | JSDoc improvements, documentation updates |
| 3.2.0 | Color support for Deno |
| 3.1.0 | Callable support, type improvements |
| 3.0.0 | Major refactor, simplified API |

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
| Forwarder tests | [tests/forward.test.ts](tests/forward.test.ts) |
| Color examples | [tests/deno-raw.ts](tests/deno-raw.ts) |
| Build script | [scripts/build-npm.ts](scripts/build-npm.ts) |
| Package config | [deno.json](deno.json) |
| Human documentation | [README.md](README.md) |
| API documentation | [API.md](API.md) |
| Machine documentation | [AGENTS.md](AGENTS.md) |
| AI assistant context | [CLAUDE.md](CLAUDE.md) |
