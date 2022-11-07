import { strict as assert } from 'node:assert';
import { ClogConfig, createClog } from './index.js';

let log = [];
let error = [];
let warn = [];

const reset = () => {
	log = [];
	error = [];
	warn = [];
	ClogConfig.all();
};

// mock
const writer = {
	log: (...args) => args.forEach((v) => log.push(v)),
	error: (...args) => args.forEach((v) => error.push(v)),
	warn: (...args) => args.forEach((v) => warn.push(v)),
};

const clog = createClog('foo', ClogConfig, writer);

// clog
clog('bar', 'baz');
assert('[foo] bar baz' === log.join(' '));
assert(!error.length);
assert(!warn.length);
reset();

// clog.log
clog.log('bar', 'baz');
assert('[foo] bar baz' === log.join(' '));
assert(!error.length);
assert(!warn.length);
reset();

// clog.warn
clog.warn('bar', 'baz');
assert('[foo] bar baz' === warn.join(' '));
assert(!error.length);
assert(!log.length);
reset();

// clog.error
clog.error('bar', 'baz');
assert('[foo] bar baz' === error.join(' '));
assert(!warn.length);
assert(!log.length);
reset();

//
ClogConfig.none();
clog('bar', 'baz');
assert(!log.length);
assert(!error.length);
assert(!warn.length);
reset();

// local config
const clog2 = createClog('2', { error: true }, writer);
clog2('debug'); // noop
clog2.error('alert');
assert(!log.length);
assert('[2] alert' === error.join(' '));
assert(!warn.length);
reset();

// either change global ClogConfig.all(), or just:
createClog('Done', { log: true })('OK');
