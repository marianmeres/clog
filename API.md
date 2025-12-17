# API Reference

Complete API documentation for `@marianmeres/clog`.

## Table of Contents

- [createClog()](#createclog)
- [createClog.global](#createclogglobal)
- [createClog.reset()](#createclogreset)
- [createNoopClog()](#createnoopclog)
- [withNamespace()](#withnamespace)
- [LEVEL_MAP](#level_map)
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
| `debug` | `boolean \| undefined` | `undefined` | Global debug mode (can be overridden per-instance) |
| `stringify` | `boolean \| undefined` | `undefined` | JSON.stringify non-primitive args (can be overridden per-instance) |
| `concat` | `boolean \| undefined` | `undefined` | Concatenate all args into single string (can be overridden per-instance) |
| `stacktrace` | `boolean \| number \| undefined` | `undefined` | Append call stack to output (can be overridden per-instance). **Dev only - not for production!** |

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

Clears `hook`, `writer`, `debug`, `stringify`, `concat`, `stacktrace`, and sets `jsonOutput` to `false`. Useful for testing to ensure clean state between tests.

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
function createNoopClog(namespace?: string | null): Clog
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `namespace` | `string \| null` | `undefined` | Optional namespace (accessible via `.ns` property) |

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

Wraps a console-compatible logger with an additional namespace prefix. Works with clog instances, native console, or any logger implementing the `Logger` interface.

```typescript
function withNamespace<T extends Logger>(logger: T, namespace: string): T & ((...args: any[]) => string)
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `logger` | `Logger` | Any console-compatible logger (clog, console, or custom) |
| `namespace` | `string` | Namespace string to prepend to all log output |

### Returns

A wrapped logger with the same interface as the input, plus a callable signature. All methods prepend `[namespace]` to arguments before delegating to the parent logger.

### Examples

```typescript
import { createClog, withNamespace } from "@marianmeres/clog";

// With clog - creates nested namespaces
const clog = createClog("app");
const moduleLogger = withNamespace(clog, "module");
moduleLogger.log("hello");  // [app] [module] hello

// With native console
const logger = withNamespace(console, "my-module");
logger.warn("warning");     // [my-module] warning

// Deep nesting
const sub = withNamespace(moduleLogger, "sub");
sub.error("fail");          // [app] [module] [sub] fail

// Callable interface
moduleLogger("direct call");  // [app] [module] direct call

// Return value pattern works at any depth
throw new Error(moduleLogger.error("Something failed"));
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
  namespace: string | false;
  args: any[];
  timestamp: string;  // ISO 8601 format
  config?: ClogConfig;  // Instance config (for custom writers)
}
```

| Property | Type | Description |
|----------|------|-------------|
| `level` | `string` | RFC 5424 level name |
| `namespace` | `string \| false` | Logger namespace or `false` |
| `args` | `any[]` | All arguments passed to the log method |
| `timestamp` | `string` | ISO 8601 formatted timestamp |
| `config` | `ClogConfig \| undefined` | Instance-level config (useful for custom writers to check settings) |

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
type HookFn = WriterFn
```

Same signature as `WriterFn`. Used for collecting, batching, or analytics. Hooks are called before writers.

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
}
```

| Property | Type | Description |
|----------|------|-------------|
| `writer` | `WriterFn` | Custom writer for this instance (overridden by global writer) |
| `color` | `string \| null` | CSS color for namespace styling (browser/Deno only) |
| `debug` | `boolean` | When `false`, `.debug()` is a no-op (overrides global setting) |
| `stringify` | `boolean` | When `true`, JSON.stringify non-primitive args (overrides global setting) |
| `concat` | `boolean` | When `true`, concatenate all args into single string (overrides global setting) |
| `stacktrace` | `boolean \| number` | When enabled, append call stack to output (overrides global). **Dev only!** |

### GlobalConfig

Global configuration options.

```typescript
interface GlobalConfig {
  hook?: HookFn;
  writer?: WriterFn;
  jsonOutput?: boolean;
  debug?: boolean;
  stringify?: boolean;
  concat?: boolean;
  stacktrace?: boolean | number;
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `hook` | `HookFn` | `undefined` | Global hook called before every log |
| `writer` | `WriterFn` | `undefined` | Global writer overriding all instances |
| `jsonOutput` | `boolean` | `false` | Enable JSON output for server environments |
| `debug` | `boolean` | `undefined` | Global debug mode (can be overridden per-instance) |
| `stringify` | `boolean` | `undefined` | JSON.stringify non-primitive args (can be overridden per-instance) |
| `concat` | `boolean` | `undefined` | Concatenate all args into single string (can be overridden per-instance) |
| `stacktrace` | `boolean \| number` | `undefined` | Append call stack to output (can be overridden per-instance). **Dev only!** |

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

When `createClog.global.jsonOutput = true`:

```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "INFO",
  "namespace": "api",
  "message": "Request received",
  "arg_0": { "method": "GET" }
}
```

Error stacks are preserved as `arg_N` properties containing the stack string.
