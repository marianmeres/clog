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
├── mod.ts              # Entry point (re-exports from clog.ts)
└── clog.ts             # Main implementation
tests/
└── clog.test.ts        # Test suite (31 tests)
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

### Exports (from src/mod.ts → src/clog.ts)

| Export | Type | Description |
|--------|------|-------------|
| `createClog` | Function | Factory for creating logger instances |
| `createClog.global` | GlobalConfig | Global configuration object |
| `createClog.reset` | Function | Reset global config to defaults |
| `LEVEL_MAP` | Const Object | RFC 5424 level mapping |
| `LogLevel` | Type | `"debug" \| "log" \| "warn" \| "error"` |
| `LogData` | Type | Normalized log data structure |
| `WriterFn` | Type | Writer function signature |
| `HookFn` | Type | Hook function signature (alias of WriterFn) |
| `Logger` | Interface | Console-compatible logger interface |
| `Clog` | Interface | Callable Logger with namespace |
| `ClogConfig` | Interface | Instance configuration options |
| `GlobalConfig` | Interface | Global configuration options |

### Function Signatures

```typescript
function createClog(namespace?: string | false, config?: ClogConfig): Clog

createClog.global: GlobalConfig
createClog.reset: () => void
```

### Type Definitions

```typescript
type LogLevel = "debug" | "log" | "warn" | "error";

type LogData = {
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR";
  namespace: string | false;
  args: any[];
  timestamp: string; // ISO 8601
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
  debug?: boolean;  // when false, .debug() is a no-op (overrides global)
}

interface GlobalConfig {
  hook?: HookFn;
  writer?: WriterFn;
  jsonOutput?: boolean;
  debug?: boolean;  // when false, .debug() is a no-op (can be overridden per-instance)
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
None (zero dependencies)

### Development
- `@std/assert` - Testing assertions
- `@std/fs` - File system utilities (build script)
- `@std/path` - Path utilities (build script)
- `@marianmeres/npmbuild` - npm build helper

## Test Coverage

31 tests covering:
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

### Log Batching

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

### Debug Mode

```typescript
// Global: disable debug in production
createClog.global.debug = process.env.NODE_ENV !== "production";

// Per-instance: override global setting
const verboseLog = createClog("verbose", { debug: true }); // always debug
const quietLog = createClog("quiet", { debug: false });    // never debug
```

### Testing

```typescript
beforeEach(() => {
  createClog.reset(); // Clean state
});

const captured: LogData[] = [];
createClog.global.hook = (data) => captured.push(data);
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
| Main implementation | [src/clog.ts](src/clog.ts) |
| Entry point | [src/mod.ts](src/mod.ts) |
| Tests | [tests/clog.test.ts](tests/clog.test.ts) |
| Build script | [scripts/build-npm.ts](scripts/build-npm.ts) |
| Package config | [deno.json](deno.json) |
| Human documentation | [README.md](README.md) |
| API documentation | [API.md](API.md) |
