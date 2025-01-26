# @marianmeres/clog

On top of console.log. Mostly.

Tiny namespaced console wrapper with configurable silence switches (global or local).
And with custom writer support.

## Installation

### Deno

```bash
deno add jsr:@marianmeres/clog
```

### Node

```bash
npx jsr add @marianmeres/clog
```

## Usage

```typescript
// create logger
const clog = createClog("foo");

// use any of the debug, info, log, warn, error (or none) methods
clog("bar", "baz"); // same as clog.log
clog.debug("bar", "baz");
clog.log("bar", "baz");
clog.info("bar", "baz");
clog.warn("bar", "baz");
clog.error("bar", "baz");
// 6 x output: [foo] bar baz

// example for errors only output (configured locally)
const clog = createClog("foo", { error: true });
clog("debug"); // ignored
clog.error("error");
// output: [foo] error

// example for global config silence
createClog.DISABLE = true;
clog("bar", "baz");
// output none

// to use clog without namespace, use `false`
createClog(false)("foo", "bar");
// output: foo bar

// to color the namespace label use `color` or the %c modifier
// these examples work in browser or deno (not in node)
clog("%cbar", "color:red");
clog.color("red")("bar");
// outputs "[foo] bar" where "[foo]" is in red (but not bar)

// you can automatically prepend time or dateTime
const clog = createClog("foo", { time: true });
clog("bar");
// outputs: [HH:MM:SS.mmm] [foo] bar

const clog = createClog("foo", { dateTime: true });
clog("bar");
// outputs: [YYYY-MM-DD HH:MM:SS.mmm] [foo] bar
```

## Custom writer setup example

This creates colored output based on log level

```typescript
import { gray, green, red, yellow } from "kleur/colors";

// somewhere in app bootstrap
const _setup = (k, c) => (...a) => console[k].apply(null, a.map((v) => c(v)));
createClog.WRITER = {
	debug: _setup("debug", gray),
	log: _setup("log", gray),
	info: _setup("info", green),
	warn: _setup("warn", yellow),
	error: _setup("error", red),
};

// somewhere later in app
const clog = createClog("my-module");
clog("foo"); // output "[my-module] foo" in gray
clog.info("success"); // output "[my-module] success" in green
clog.error("alert!"); // output "[my-module] alert!" in red
```
