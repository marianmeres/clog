import path from 'node:path';
import { strict as assert } from 'node:assert';
import { TestRunner } from '@marianmeres/test-runner';
import { fileURLToPath } from 'node:url';
import { createClog, createClogStr } from '../dist/index.js';

let output = {};
const reset = () => {
	output = {};
	createClog.CONFIG.reset();
};

const _init =
	(k) =>
	(...args) =>
		args.forEach((v) => {
			output[k] ||= '';
			output[k] += v;
		});

const writer = {
	info: _init('info'),
	debug: _init('debug'),
	log: _init('log'),
	error: _init('error'),
	warn: _init('warn'),
};

const suite = new TestRunner(path.basename(fileURLToPath(import.meta.url)), {
	beforeEach: reset,
	after: reset,
});

suite.test('it works', () => {
	['info', 'debug', 'log', 'error', 'warn'].forEach((k) => {
		reset();
		const clog = createClog('foo', null, writer);
		clog[k]('bar', 'baz');
		assert(output[k] === '[foo]barbaz');
		assert(Object.keys(output).length === 1);
	});
});

suite.test('global config', () => {
	const clog = createClog('foo', null, writer);
	clog('bar');
	assert(output.log === '[foo]bar');
	createClog.CONFIG.none();
	clog('baz');
	assert(output.log === '[foo]bar'); // no change
	createClog.CONFIG.all();
	clog('bat');
	assert(output.log === '[foo]bar[foo]bat');
});

suite.test('local vs global config 1', () => {
	const clog = createClog('foo', { log: true }, writer);
	// will be ignored since local has higher importance
	createClog.CONFIG.none();
	clog('bar');
	assert(output.log === '[foo]bar');
	// except for master switch
	createClog.CONFIG.MASTER = false;
	clog('baz');
	assert(output.log === '[foo]bar'); // no baz
});

suite.test('local vs global config 1', () => {
	// testing global writer (just as a side test here)
	createClog.CONFIG.WRITER = writer;

	const clog = createClog('foo', { log: false });
	// will be ignored since local has higher importance
	createClog.CONFIG.all();
	clog('bar');
	assert(!output.log);
	// except for master switch
	createClog.CONFIG.MASTER = true;
	clog('baz');
	assert(output.log === '[foo]baz');
});

suite.test('filter test', () => {
	createClog.CONFIG.WRITER = writer;
	const clog = createClogStr('foo');

	clog({ a: 123 }, 456);
	
	// not [object Object]
	assert(output.log === `[foo]{\n    "a": 123\n}456`);
});

export default suite;
