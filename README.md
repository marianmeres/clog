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
clog.log("Hello", "world");        // [my-app] Hello world
clog.debug("Debug info");          // [my-app] Debug info
clog.warn("Warning message");      // [my-app] Warning message
clog.error("Error occurred");      // [my-app] Error occurred

// Or call directly (proxies to .log)
clog("Hello", "world");            // [my-app] Hello world

// Without namespace
const logger = createClog();
logger.log("No namespace");        // No namespace

// Return value useful for throwing
throw new Error(clog.error("Something failed"));
```

## Design Philosophy

**No filtering by log level** - This library intentionally does not include `LOG_LEVEL` filtering. If you don't want certain logs, don't write them. Use your hook to filter if really needed.

**No enable/disable switches** -  Control what you log at the source.

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

Fancy colors, complex formatting, and visual embellishments on the server provide no value - they actually make logs *harder* to process and search.

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
const logger: Logger = console;  // ✓ console methods return void
const clog: Logger = createClog("app");  // ✓ clog methods return string
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

authLog.log("User logged in");     // [auth] User logged in
apiLog.warn("Slow request");       // [api] Slow request
dbLog.error("Connection failed");  // [database] Connection failed
```

### Nested Namespaces

Use `withNamespace()` to wrap any console-compatible logger with an additional namespace. This is useful when passing loggers to modules that want their own namespace while preserving the parent context:

```typescript
import { createClog, withNamespace } from "@marianmeres/clog";

const appLog = createClog("app");
const moduleLog = withNamespace(appLog, "auth");

moduleLog.log("User logged in");   // [app] [auth] User logged in

// Deep nesting works too
const subLog = withNamespace(moduleLog, "oauth");
subLog.warn("Token expired");      // [app] [auth] [oauth] Token expired

// Works with native console
const consoleLog = withNamespace(console, "my-module");
consoleLog.error("Something failed");  // [my-module] Something failed

// Return value pattern works at any nesting depth
throw new Error(moduleLog.error("Authentication failed"));
```

**Note:** When using `color` config, only the original logger's namespace is colored. Namespaces added via `withNamespace()` appear as plain text.

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
// Enable JSON output globally
createClog.global.jsonOutput = true;

const clog = createClog("api");
clog.log("Request received", { method: "GET", path: "/users" });

// Output (single line):
// {"timestamp":"2025-11-29T10:30:45.123Z","level":"INFO","namespace":"api","message":"Request received","arg_0":{"method":"GET","path":"/users"}}
```

### Log Levels

Maps console methods to standard log levels (RFC 5424):

```typescript
import { LEVEL_MAP } from "@marianmares/clog";

clog.debug("Debug");  // DEBUG
clog.log("Info");     // INFO
clog.warn("Warning"); // WARNING
clog.error("Error");  // ERROR
```

### Return Value Pattern

All log methods return the first argument as a string (typed as `any` for console compatibility), useful for error handling:

```typescript
const clog = createClog("auth");

// Convenient error throwing
throw new Error(clog.error("Authentication failed"));

// Or for validation
const userId = validateUser() ||
  throw new Error(clog.error("Invalid user"));
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

auth.log("Login attempt");  // Added to batch
api.warn("Slow query");     // Added to batch
```

Hook receives normalized data:

```typescript
type LogData = {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  namespace: string | false;
  args: any[];
  timestamp: string;  // ISO 8601 format
};
```

### Custom Writer

Replace the default output completely:

```typescript
// Global writer (affects all instances)
createClog.global.writer = (data) => {
  myCustomLogSystem.write({
    time: data.timestamp,
    severity: data.level,
    module: data.namespace,
    message: data.args.join(" ")
  });
};

// Instance-level writer
const clog = createClog("test", {
  writer: (data) => {
    console.log(`Custom: ${data.level} - ${data.args[0]}`);
  }
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
import { createClog, red, green, blue, yellow } from "@marianmeres/clog";

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

apiLog.debug("skipped in production");  // Respects global setting
dbLog.debug("also skipped");            // Respects global setting

// Per-instance: override global setting
const verboseLog = createClog("verbose", { debug: true });
verboseLog.debug("always outputs");     // Overrides global

// Or disable for specific logger
const quietLog = createClog("quiet", { debug: false });
quietLog.debug("never outputs");        // Overrides global
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

| Config | Objects | Console args |
|--------|---------|--------------|
| neither | as-is | multiple |
| `stringify: true` | JSON.stringify | multiple |
| `concat: true` | JSON.stringify | **single string** |

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

**Precedence:** Instance `config.stacktrace` → Global `createClog.global.stacktrace` → Default (`undefined`/disabled)

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
clog.ns;               // readonly namespace

// Nested namespaces (wrap any console-compatible logger)
const nested = withNamespace(clog, "module");
nested.log("msg");     // [original-ns] [module] msg

// Global configuration
createClog.global.hook = (data: LogData) => { /* ... */ };
createClog.global.writer = (data: LogData) => { /* ... */ };
createClog.global.jsonOutput = true;
createClog.global.debug = false;     // disable debug globally
createClog.global.stringify = true;  // JSON.stringify objects
createClog.global.concat = true;     // single string output
createClog.global.stacktrace = true; // append call stack (dev only!)

// Reset global config
createClog.reset();
```

### Types

```typescript
interface ClogConfig {
  writer?: WriterFn;
  color?: string | null;
  debug?: boolean;              // when false, .debug() is a no-op
  stringify?: boolean;          // JSON.stringify non-primitive args
  concat?: boolean;             // concatenate all args into single string
  stacktrace?: boolean | number; // append call stack (dev only!)
}

interface GlobalConfig {
  hook?: HookFn;
  writer?: WriterFn;
  jsonOutput?: boolean;
  debug?: boolean;              // can be overridden per-instance
  stringify?: boolean;          // can be overridden per-instance
  concat?: boolean;             // can be overridden per-instance
  stacktrace?: boolean | number; // can be overridden per-instance (dev only!)
}

type LogData = {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  namespace: string | false;
  args: any[];
  timestamp: string;
  config?: ClogConfig;  // instance config (for custom writers)
};
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
// {"timestamp":"2025-11-29T10:30:45.123Z","level":"INFO","namespace":"api","message":"Request received","arg_0":{"userId":123}}
```

### Testing with No-Op Logger

For tests where you want to suppress all console output, use `createNoopClog`:

```typescript
import { createNoopClog } from "@marianmeres/clog";

// Create a silent logger - no output at all
const clog = createNoopClog("test");

clog.log("silent");        // returns "silent", outputs nothing
clog.error("fail");        // returns "fail", outputs nothing

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

For production log batching and forwarding, use the included `createLogForwarder` utility:

```typescript
import { createClog } from "@marianmeres/clog";
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

The forwarder wraps [@marianmeres/batch](https://github.com/marianmeres/batch) and provides:
- **Time-based flushing** (`flushIntervalMs`) - flush every N ms
- **Threshold-based flushing** (`flushThreshold`) - flush when buffer reaches N items
- **Buffer overflow protection** (`maxBatchSize`) - oldest items discarded if exceeded
- **Graceful shutdown** (`drain()`) - flush remaining items before exit
- **State monitoring** (`subscribe()`) - observe buffer size and flush status

Full API: `hook`, `add`, `flush`, `drain`, `start`, `stop`, `reset`, `dump`, `configure`, `subscribe`, `size`, `isRunning`, `isFlushing`

## Global Configuration Across Bundled Dependencies

When using `@marianmeres/clog` in an application with multiple dependencies that each bundle their own copy of the library, the global configuration (`createClog.global`) is **truly shared** across all instances.

This works because the global state uses `Symbol.for()` + `globalThis`:

```typescript
// Internally, clog stores global config like this:
const GLOBAL_KEY = Symbol.for("@marianmeres/clog");
const GLOBAL = (globalThis as any)[GLOBAL_KEY] ??= { /* defaults */ };
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

