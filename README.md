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
const createClog = (ns, config: boolean | ConfigFlags = null, writer: Writer = null): Writer

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

For custom writer setup see [test](tests/clog.test.js)
