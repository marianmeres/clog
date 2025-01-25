// deno-lint-ignore-file no-explicit-any

export type LogFn = (...args: any[]) => void;

/** Writer interface */
export interface Writer {
	debug: LogFn;
	log: LogFn;
	info: LogFn;
	warn: LogFn;
	error: LogFn;
}

/** Factory configuration */
export interface ClogConfigFlags extends Record<keyof Writer, boolean> {
	dateTime: boolean;
	time: boolean;
}

export type Clog = LogFn &
	Writer & { ns: string | false; color: (color: string | null) => Clog };

/** Will create a logger with provided "namespace". */
export function createClog(
	ns: string | false,
	config?: Partial<ClogConfigFlags> | boolean | null,
	writer?: Partial<Writer> | null,
	argsFilter?: null | ((clogArgs: any[]) => any[])
): Clog {
	writer ??= {
		debug: console.debug,
		log: console.log,
		info: console.info,
		warn: console.warn,
		error: console.error,
	};

	const _rawNsBkp = ns;

	// explicit false means no "namespace"
	ns = ns !== false ? `[${ns}]` : "";

	// default is global, also support for boolean shortcuts
	config ??= createClog.CONFIG;
	if (config === true) config = _confObj(true);
	if (config === false) config = _confObj(false);

	//
	let _color: string | null = null;

	const _apply = (k: keyof Writer, args: any[]) => {
		// maybe master flag disabled
		if (createClog.DISABLED) return;

		// maybe local instance config disabled
		if (!config[k]) return;

		// acquire writer (global has priority)
		let w = writer;
		if (createClog.WRITER) w = createClog.WRITER;

		// maybe writer does not support current log method
		if (!w[k]) return;

		// keep original ns intact
		let _ns = ns;

		// may attach timestamps
		if (config?.dateTime || config?.time) {
			const now = new Date();
			let ts = _hms(now);
			if (config?.dateTime) ts = _ymd(now) + " " + ts;
			_ns = `[${ts}] ${_ns}`.trim();
		}

		// finalize args
		if (typeof argsFilter === "function") {
			args = argsFilter(args);
		}
		args = _ns ? [_ns, ...args] : [...args];

		// console color formatting experimental support dance, but only if we have not specified color yet
		const colorMark = "%c";
		if (!_color) {
			if (
				// if first (after ns) arg starts with color marker
				typeof args[1] === "string" &&
				args[1]?.startsWith(colorMark) &&
				// and second (after ns) arg exists and is string
				args[2] &&
				typeof args[2] === "string"
			) {
				// extract the color mark and put if first (doesn't work otherwise)
				// NOTE: only the first arg will be colored (which is the namespace label)... which is OK
				args[0] = colorMark + args[0];
				args[1] = args[1].slice(colorMark.length);
				args = _moveArrayElement(args, 2, 1);
			}
		} else {
			// we have a "global" color, so need to adjust args
			args[0] = colorMark + args[0];
			args.splice(1, 0, `color:${_color}`);
		}

		// actual log finally...
		w[k]?.(...args);
	};

	const clog = (...args: any[]) => _apply("log", args);
	clog.debug = (...args: any[]) => _apply("debug", args);
	clog.info = (...args: any[]) => _apply("info", args);
	clog.warn = (...args: any[]) => _apply("warn", args);
	clog.error = (...args: any[]) => _apply("error", args);
	clog.log = clog;
	clog.ns = _rawNsBkp;

	clog.color = (color: string | null) => {
		_color = color;
		return clog;
	};

	return clog;
}

// default globals
const _CONFIG = {
	debug: true,
	log: true,
	info: true,
	warn: true,
	error: true,
	//
	dateTime: false,
	time: false,
};

const _DISABLED = false;

const _WRITER = null;

/** Global config */
createClog.CONFIG = _CONFIG as Partial<ClogConfigFlags> | boolean;

/** Master global `disabled` switch. If truthy, every instance will become no-op. */
createClog.DISABLED = _DISABLED as boolean;

/** Master global Writer */
createClog.WRITER = _WRITER as Partial<Writer> | null;

/** Resets globals to default, out-of-the-box state. Needed for tests. */
createClog.reset = (): void => {
	createClog.CONFIG = _CONFIG;
	createClog.DISABLED = _DISABLED;
	createClog.WRITER = _WRITER;
};

/** createClog with pretty JSON.stringify-ied output. */
export const createClogStr = (
	ns: string | false,
	config?: Partial<ClogConfigFlags> | boolean | null,
	writer?: Partial<Writer> | null
): Clog =>
	createClog(ns, config, writer, (args: any[]) => {
		return args.map((a) => {
			return typeof a === "string" || !_isPlainObject(a)
				? a
				: JSON.stringify(a, null, 4);
		});
	});

/** Internal DRY util */
function _confObj(v = true): ClogConfigFlags {
	return {
		debug: v,
		log: v,
		info: v,
		warn: v,
		error: v,
		dateTime: v,
		time: v,
	};
}

/** YYYY-MM-DD date format */
function _ymd(d: Date): string {
	const p = (v: number) => v.toString().padStart(2, "0");
	return [d.getFullYear(), p(d.getMonth() + 1), p(d.getDate())].join("-");
}

/** HH:MM:SS.mmm date format */
function _hms(d: Date): string {
	const p = (v: number) => v.toString().padStart(2, "0");
	return [
		p(d.getHours()),
		p(d.getMinutes()),
		p(d.getSeconds()) + "." + d.getMilliseconds().toString().padEnd(3, "0"),
	].join(":");
}

/** Will move array element from `fromIndex` to `toIndex` */
function _moveArrayElement(
	arr: any[],
	fromIndex: number,
	toIndex: number
): any[] {
	if (fromIndex < 0 || fromIndex >= arr.length) {
		throw new RangeError("Invalid fromIndex");
	}
	if (toIndex < 0 || toIndex >= arr.length) {
		throw new RangeError("Invalid toIndex");
	}

	const element = arr.splice(fromIndex, 1)[0];
	arr.splice(toIndex, 0, element);
	return arr;
}

/** Internal helper */
function _isPlainObject(v: any): boolean {
	return (
		v !== null &&
		typeof v === "object" &&
		[undefined, Object].includes(v.constructor)
	);
}
