// deno-lint-ignore-file no-explicit-any

import { assertEquals, assertMatch } from "@std/assert";
import { createClog, createClogStr, type Writer } from "../clog.ts";

let output: Record<string, any> = {};
const reset = () => {
	output = {};
	createClog.reset();
};

const _init =
	(k: keyof Writer) =>
	(...args: any[]) => {
		args.forEach((v) => {
			output[k] ||= "";
			output[k] += v;
		});
		return writer;
	};

const writer = () => ({
	info: _init("info"),
	debug: _init("debug"),
	log: _init("log"),
	error: _init("error"),
	warn: _init("warn"),
});

Deno.test("it works", () => {
	reset();
	(["info", "debug", "log", "error", "warn"] as (keyof Writer)[]).forEach(
		(k) => {
			reset();
			const clog = createClog("foo", null, writer());
			clog[k]("bar", "baz");
			assertEquals(output[k], "[foo]barbaz");
			assertEquals(Object.keys(output).length, 1);
			assertEquals(clog.ns, "foo");
		}
	);
});

Deno.test("global config", () => {
	reset();
	const clog = createClog("foo", null, writer());
	clog("bar");
	assertEquals(output.log, "[foo]bar");
	createClog.WRITER = {}; // empty
	clog("baz");
	assertEquals(output.log, "[foo]bar"); // no change
	createClog.WRITER = { log: writer().log };
	clog("bat");
	assertEquals(output.log, "[foo]bar[foo]bat");
});

Deno.test("local vs global config", () => {
	reset();
	const clog = createClog("foo", { log: true }, writer());
	// will be ignored since local has higher importance
	createClog.CONFIG = {};
	clog("bar");
	assertEquals(output.log, "[foo]bar");
	// except for master switch
	createClog.DISABLED = true;
	clog("baz");
	assertEquals(output.log, "[foo]bar"); // no baz
});

Deno.test("no namespace", () => {
	reset();
	const clog = createClog(false, null, writer());
	clog("bar");
	assertEquals(output.log, "bar");
});

Deno.test("time", () => {
	reset();
	const clog = createClog("foo", { log: true, time: true }, writer());
	clog("bar");
	assertMatch(output.log, /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[foo\]bar$/);
});

Deno.test("datetime", () => {
	reset();
	const clog = createClog("foo", { log: true, dateTime: true }, writer());
	clog("bar");
	assertMatch(
		output.log,
		/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] \[foo\]bar$/
	);
});

Deno.test("colors", () => {
	reset();
	const clog = createClog("foo", null, writer());
	// const clog = createClog("foo");
	clog("%cbar", "color:red", "baz");
	assertEquals(output.log, "%c[foo]color:redbarbaz");
});

Deno.test("colors 2", () => {
	reset();
	const clog = createClogStr("foo", null, writer()).color("red");
	// const clog = createClog("foo").color("red");
	clog({ bar: 123 });
	clog.color(null)("hey");
	clog.color("pink")("ho");
	assertEquals(
		output.log,
		'%c[foo]color:red{\n    "bar": 123\n}[foo]hey%c[foo]color:pinkho'
	);
});

Deno.test("createClogStr", () => {
	reset();
	const clog = createClog("foo", null, writer());
	clog({ a: 123 }, 456, new Response());
	assertEquals(output.log, "[foo][object Object]456[object Response]");

	reset();
	const clog2 = createClogStr("foo", null, writer());
	clog2({ a: 123 }, 456, new Response());
	assertEquals(output.log, '[foo]{\n    "a": 123\n}456[object Response]');
});
