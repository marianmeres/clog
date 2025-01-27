// deno-lint-ignore-file no-explicit-any

import { assert, assertEquals, assertMatch, assertThrows } from "@std/assert";
import { createClog, createClogStr, type Writer } from "../clog.ts";

let output: Record<string, any> = {};
let output2: Record<string, any[]> = {};

const reset = () => {
	output = {};
	output2 = {};
	createClog.reset();
};

const _init =
	(k: keyof Writer) =>
	(...args: any[]) => {
		args.forEach((v) => {
			output[k] ||= "";
			output[k] += v;

			output2[k] ||= [];
			output2[k].push(v);
		});
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
			// for simplicity case here disabling colors...
			const clog = createClog("foo", { colors: false }, writer());
			clog[k]("bar", "baz");
			assertEquals(output[k], "[foo]barbaz");
			assertEquals(Object.keys(output).length, 1);
			assertEquals(clog.ns, "foo");

			// ns is readonly
			assertThrows(() => (clog.ns = "asdf"));
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

Deno.test("colors via %c", () => {
	reset();
	const clog = createClog("foo", null, writer());
	// const clog = createClog("foo");
	clog("%cbar", "color:red", "baz");
	assertEquals(output.log, "%c[foo]color:redbarbaz");

	reset();
	clog("%c", "color:red", {});
	assertEquals(output.log, "%c[foo]color:red[object Object]");

	// console.log(output2);
	// check if empty string artifact was removed
	assert(!output2.log.some((v) => v === ""));

	// default colors
	reset();
	clog.warn("warn");
	assertEquals(output.warn, "%c[foo]color:darkorangewarn");
});

Deno.test("colors via color()", () => {
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

	// instance provided color has priority over system one
	reset();
	clog.warn("warn"); // pink, not orange
	assertEquals(output.warn, "%c[foo]color:pinkwarn");

	// when we reset the instance color, must fall back to system orange
	reset();
	clog.color(null).warn("warn");
	assertEquals(output.warn, "%c[foo]color:darkorangewarn");

	// global no colors
	reset();
	createClog.COLORS = false;
	clog.warn("warn");
	assertEquals(output.warn, "[foo]warn");
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

Deno.test("all config", () => {
	reset();
	const clog = createClog(false, { all: false, time: true }, writer());
	clog("bar");
	assertEquals(output.log, undefined); // no-op

	reset();
	const clog2 = createClog(false, { time: true }, writer());
	clog2("bar");
	assert(output.log.endsWith("]bar"));
});

Deno.test("chain api", () => {
	reset();
	const clog = createClog(false, null, writer());
	clog.color("red").log("bar").color(null).log("baz");
	assertEquals(output.log, "%cbarcolor:redbaz");
});
