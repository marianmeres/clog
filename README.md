# @marianmeres/clog
On top of console.log. Mostly.

Tiny namespaced console.log wrapper with configurable writer and silence config (global or local).

## Installation
```shell
$ npm i @marianmeres/clog
```

## Usage
```javascript

// create namespaced console.log wrap
const clog = createClog('foo');

// use any of the log, warn, error (or none) methods
clog('bar', 'baz'); // same as clog.log
clog.log('bar', 'baz');
clog.warn('bar', 'baz');
clog.error('bar', 'baz');
// 4 x output: [foo] bar baz

// errors only (configured locally)
const clog = createClog('foo', { error: true });
clog('debug'); // noop
clog.error('alert');
// output: [foo] alert

// global clog silence
ClogConfig.none();
clog('bar', 'baz');
// output none

```

For custom writer setup see [test](./src/index.test.js);
