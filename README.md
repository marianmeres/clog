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

## API Reference

For complete API documentation, see [API.md](API.md).

### Quick Reference

```typescript
// Create a logger
const clog = createClog(namespace?, config?);

// Log methods (return first arg as string, typed as `any`)
clog.debug(...args);   // DEBUG level
clog.log(...args);     // INFO level
clog.warn(...args);    // WARNING level
clog.error(...args);   // ERROR level
clog(...args);         // Callable, same as clog.log()

// Instance properties
clog.ns;               // readonly namespace

// Global configuration
createClog.global.hook = (data: LogData) => { /* ... */ };
createClog.global.writer = (data: LogData) => { /* ... */ };
createClog.global.jsonOutput = true;
createClog.global.debug = false;  // disable debug globally

// Reset global config
createClog.reset();
```

### Types

```typescript
interface ClogConfig {
  writer?: WriterFn;
  color?: string | null;
  debug?: boolean;  // when false, .debug() is a no-op (overrides global)
}

interface GlobalConfig {
  hook?: HookFn;
  writer?: WriterFn;
  jsonOutput?: boolean;
  debug?: boolean;  // when false, .debug() is a no-op (can be overridden per-instance)
}

type LogData = {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  namespace: string | false;
  args: any[];
  timestamp: string;
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

### Log Batching

```typescript
// app.ts - bootstrap
const logBatch: LogData[] = [];
let batchTimer: number;

createClog.global.hook = (data) => {
  logBatch.push(data);

  // Debounce flush
  clearTimeout(batchTimer);
  batchTimer = setTimeout(() => {
    if (logBatch.length > 0) {
      fetch("/api/logs", {
        method: "POST",
        body: JSON.stringify(logBatch)
      });
      logBatch.length = 0;
    }
  }, 5000);
};

// Later in your app
const clog = createClog("feature");
clog.log("Action performed");  // Will be batched and sent
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

### Real World Server-Side Log Batching Example

For production server applications, you'll want to batch logs and send them to a remote
logging service efficiently. The [@marianmeres/batch](https://github.com/marianmeres/batch)
library provides a robust batch processor that pairs perfectly with clog's hook system.

This example demonstrates a complete server-side logging setup with:
- Automatic time-based flushing (every 5 seconds)
- Threshold-based flushing (when buffer reaches 50 items)
- Buffer overflow protection (max 1000 items)
- Graceful shutdown handling
- Error resilience

```typescript
import { createClog, type LogData } from "@marianmeres/clog";
import { BatchFlusher } from "@marianmeres/batch";

// ============================================================================
// Step 1: Define the flush function that sends logs to your logging service
// ============================================================================

// This function is called by BatchFlusher whenever flush conditions are met.
// It receives an array of LogData items and should return true on success.
async function sendLogsToService(logs: LogData[]): Promise<boolean> {
  try {
    const response = await fetch("https://your-logging-service.com/api/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.LOG_SERVICE_API_KEY}`,
      },
      body: JSON.stringify({
        source: "my-server-app",
        environment: process.env.NODE_ENV,
        logs: logs.map((log) => ({
          timestamp: log.timestamp,
          level: log.level,
          namespace: log.namespace || "default",
          message: log.args[0],
          metadata: log.args.slice(1),
        })),
      }),
    });

    if (!response.ok) {
      // Log locally but don't throw - we don't want logging failures
      // to crash our app. The BatchFlusher will retry on next flush.
      console.error(`Failed to send logs: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    // Network errors, timeouts, etc.
    console.error("Log service error:", error);
    return false;
  }
}

// ============================================================================
// Step 2: Create and configure the BatchFlusher instance
// ============================================================================

// The BatchFlusher manages buffering and triggers flushes based on your config.
// It operates in three modes depending on configuration:
//
// 1. Interval Mode: Flushes every N milliseconds (flushIntervalMs > 0)
// 2. Amount Mode: Flushes when buffer reaches N items (flushThreshold > 0)
// 3. Combined Mode: Flushes on whichever condition fires first (both set)
//
// We'll use Combined Mode for optimal behavior - regular intervals for
// consistent delivery, plus threshold triggers for high-traffic bursts.

const logBatcher = new BatchFlusher<LogData>(
  // First argument: the async flusher function that processes batched items
  sendLogsToService,
  // Second argument: configuration options
  {
    // Flush every 5 seconds regardless of buffer size. (empty buffer = no flush)
    flushIntervalMs: 5000,

    // Also flush immediately when buffer reaches 50 items.
    // This prevents delays during high-traffic bursts.
    flushThreshold: 50,

    // Safety cap: if buffer grows beyond this, oldest items are discarded.
    // This protects memory during extreme scenarios (e.g., logging service down).
    // Note: reaching maxBatchSize does NOT trigger a flush - items are just dropped.
    maxBatchSize: 1000,

    // Enable debug output for troubleshooting (uses console by default)
    debug: process.env.NODE_ENV === "development",
  }
);

// ============================================================================
// Step 3: Connect clog to the BatchFlusher via the global hook
// ============================================================================

// The global hook is called for EVERY log from ANY clog instance.
// This is the integration point between clog and your batching system.
createClog.global.hook = (data: LogData) => {
  // Simply add each log entry to the batcher.
  logBatcher.add(data);
};

// ============================================================================
// Step 4: Use clog throughout your application
// ============================================================================

// Create loggers for different modules/components...
const httpLog = createClog("http");
const dbLog = createClog("database");
const authLog = createClog("auth");

// Now, use logger instances as you would normally...

// ============================================================================
// Step 5: Graceful shutdown handling (optional, but recommended)
// ============================================================================

// NOTE: Always drain the batcher before shutting down your server.
// drain() flushes any remaining buffered logs, then stops the interval timer.
// Without this, you may lose logs that haven't been flushed yet.

async function gracefulShutdown() {
  console.log("Shutting down, flushing remaining logs...");

  // drain() returns a Promise that resolves when the final flush completes
  const success = await logBatcher.drain();

  if (success) {
    console.log("All logs flushed successfully");
  } else {
    console.warn("Some logs may not have been sent");
  }

  process.exit(0);
}

// Handle common shutdown signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// ============================================================================
// Step 6: Monitoring (optional)
// ============================================================================

// Subscribe to state changes for monitoring/alerting
const unsubscribe = logBatcher.subscribe((state) => {
  // state.size: current number of items in buffer
  // state.isRunning: whether interval-based flushing is active
  // state.isFlushing: whether a flush operation is currently in progress

  // Alert if buffer is getting full (approaching maxBatchSize)
  if (state.size > 800) {
    console.warn(`Log buffer high: ${state.size}/1000 items`);
  }
});

// Call unsubscribe() when you no longer need monitoring
// unsubscribe();
```

For more details check the [@marianmeres/batch](https://github.com/marianmeres/batch) documentation.

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

