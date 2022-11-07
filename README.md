# @marianmeres/clog
On top of console.log. Mostly.

Tiny namespaced console.log wrapper with configurable silence switches (global or local).
And with custom writer support.

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

// to use clog without namespace, use `false`
createClog(false)('foo', 'bar');

```

For custom writer setup see [src/index.test.js](./src/index.test.js)
