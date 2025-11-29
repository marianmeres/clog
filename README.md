# @marianmeres/clog

Simple, universal logger with namespace support that works everywhere - browser, Node.js, and Deno.

## Why clog?

- **Console-compatible API** - Drop-in replacement for `console.log/debug/warn/error`
- **Works everywhere** - Single API for browser and server environments
- **Auto-adapts** - Detects environment and outputs appropriately
- **Namespace support** - Organize logs by module/component
- **Structured logging** - JSON output for log aggregation tools
- **Extensible** - Hook into logs for batching/collection
- **Tiny** - ~200 lines, zero dependencies

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

// Without namespace
const logger = createClog();
logger.log("No namespace");        // No namespace

// Return value useful for throwing
throw new Error(clog.error("Something failed"));
```

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

All log methods return the first argument as a string, useful for error handling:

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

### Browser Colors

Add color to namespace labels in browser console:

```typescript
const clog = createClog("ui", { color: "blue" });
clog.log("Button clicked");
// Output: [ui] Button clicked  (namespace in blue)

const errorLog = createClog("errors", { color: "red" });
errorLog.error("Failed to load");
// Output: [errors] Failed to load  (namespace in red)
```

Colors only work in browser environments (uses `%c` formatting).

## API Reference

### `createClog(namespace?, config?)`

Creates a logger instance.

**Parameters:**
- `namespace?: string | false` - Namespace for the logger (default: `false`)
- `config?: ClogConfig` - Optional configuration

**Returns:** `Logger`

```typescript
interface Logger {
  debug: (...args: any[]) => string;
  log: (...args: any[]) => string;
  warn: (...args: any[]) => string;
  error: (...args: any[]) => string;
  ns: string | false;  // readonly
}

interface ClogConfig {
  writer?: WriterFn;
  color?: string | null;
}
```

### Global Configuration

```typescript
// Access global config
createClog.global.hook = (data: LogData) => { /* ... */ };
createClog.global.writer = (data: LogData) => { /* ... */ };
createClog.global.jsonOutput = true;

// Reset to defaults (useful for testing)
createClog.reset();
```

### Level Mapping

```typescript
import { LEVEL_MAP } from "@marianmares/clog";

console.log(LEVEL_MAP);
// {
//   debug: "DEBUG",
//   log: "INFO",
//   warn: "WARNING",
//   error: "ERROR"
// }
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
import { createClog } from "@marianmares/clog";
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

## Design Philosophy

**No filtering by log level** - This library intentionally does not include `LOG_LEVEL` filtering. If you don't want certain logs, don't write them. Use your hook to filter if needed.

**No enable/disable switches** - Removed in favor of simplicity. Control what you log at the source.

**Console-compatible** - You can replace `console.log` with `clog.log` without changing anything else.

**One API for all environments** - Auto-detection means you write code once, it works everywhere.

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

MIT
