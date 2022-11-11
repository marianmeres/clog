# @marianmeres/clog
On top of console.log. Mostly.

Tiny namespaced console wrapper with configurable silence switches (global or local).
And with custom writer support.

## Installation
```shell
$ npm i @marianmeres/clog
```

## Usage
```typescript

// factory signature
const createClog = (ns, config: boolean | ConfigFlags = null, writer: Writer = null) => Writer

// create logger
const clog = createClog('foo');

// use any of the debug, info, log, warn, error (or none) methods
clog('bar', 'baz'); // same as clog.log
clog.debug('bar', 'baz');
clog.log('bar', 'baz');
clog.info('bar', 'baz');
clog.warn('bar', 'baz');
clog.error('bar', 'baz');
// 6 x output: [foo] bar baz

// example for errors only output (configured locally)
const clog = createClog('foo', { error: true });
clog('debug'); // ignored
clog.error('error');
// output: [foo] error

// example for global config silence
createClog.CONFIG.none();
clog('bar', 'baz');
// output none

// to use clog without namespace, use `false`
createClog(false)('foo', 'bar');
// output: foo bar
```

## Custom writer setup example

This creates colored output based on log level

```typescript
import { gray, green, red, yellow } from 'kleur/colors';

// somewhere in app bootstrap
const _setup = (k, c) => (...a) => console[k].apply(null, a.map((v) => c(v)));
createClog.CONFIG.WRITER = {
    debug: _setup('debug', gray),
    log: _setup('log', gray),
    info: _setup('info', green),
    warn: _setup('warn', yellow),
    error: _setup('error', red),
};

// somewhere later in app
const clog = createClog('my-module');
clog('foo') // output "[my-module] foo" in gray
clog.info('success'); // output "[my-module] success" in green
clog.error('alert!') // output "[my-module] alert!" in red

```
