# CLAUDE.md - AI Assistant Context

Quick reference for AI assistants working with this codebase.

## What is this?

`@marianmeres/clog` is a universal console-compatible logger for browser, Node.js, and Deno with:
- Namespace support
- Colored output (browser/Deno)
- JSON output mode for servers
- Zero dependencies

## Key Files

| Purpose | File |
|---------|------|
| Logger implementation | `src/clog.ts` |
| Color utilities | `src/colors.ts` |
| Entry point | `src/mod.ts` |
| Tests | `tests/clog.test.ts` |

## Common Tasks

```bash
# Run tests
deno test

# Run tests (watch mode)
deno test --watch

# Build npm package
deno run -A scripts/build-npm.ts
```

## Key Concepts

1. **createClog(namespace, config)** - Factory for logger instances
2. **createNoopClog(namespace)** - Factory for no-op logger instances (for testing, outputs nothing)
3. **Callable interface** - `clog("msg")` is same as `clog.log("msg")`
4. **Return value pattern** - All methods return first arg as string: `throw new Error(clog.error("msg"))`
5. **Global config** - `createClog.global` affects all instances (uses Symbol.for for true global state)
6. **StyledText** - Symbol-tagged objects for colored output that work with both `clog()` and `console.log(...)`
7. **withNamespace(logger, ns)** - Wraps any console-compatible logger with additional namespace prefix

## Color System

```typescript
// Color shortcuts (return StyledText)
import { red, green, blue } from "@marianmeres/clog";
clog("Status:", green("OK"));

// With console.log (spread required)
console.log(...red("error"));

// String concatenation safe (returns plain text)
"Status: " + green("OK") // "Status: OK"
```

Safe hex colors in `SAFE_COLORS` are optimized for both light and dark backgrounds.

## Architecture Notes

- Runtime detection: `_detectRuntime()` in clog.ts
- Writer precedence: global.writer > config.writer > colorWriter > defaultWriter
- Debug mode: config.debug > global.debug > true (enabled by default)
- Stringify mode: config.stringify > global.stringify > false (JSON.stringify non-primitives)
- Concat mode: config.concat > global.concat > false (single string output)
- Symbol `CLOG_STYLED` identifies StyledText objects for special handling in writers

## For Detailed Documentation

- Human-readable: [README.md](README.md)
- API reference: [API.md](API.md)
- Machine-readable: [AGENTS.md](AGENTS.md)
