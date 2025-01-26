// deno-lint-ignore-file no-explicit-any

/** Log function type */
export type LogFn = (...args: any[]) => void;

/** CLog function type */
export type CLogFn = (...args: any[]) => Clog;

/** Writer interface */
export interface Writer {
	debug: LogFn;
	log: LogFn;
	info: LogFn;
	warn: LogFn;
	error: LogFn;
}

/** Factory configuration */
export interface ClogConfigFlags
	extends Record<ClogColorConfigKey, string | null>,
		Record<keyof Writer, boolean> {
	all?: boolean;
	dateTime: boolean;
	time: boolean;
	colors: boolean;
}

/** createClog return type */
export type Clog = CLogFn &
	Record<keyof Writer, CLogFn> & {
		ns: string | false;
		color: (color: string | null) => Clog;
		colors: boolean;
	};

export type ClogColorConfigKey =
	| "debugColor"
	| "logColor"
	| "infoColor"
	| "warnColor"
	| "errorColor";

/** Default "debug" color */
const _COLOR_DEBUG = "gray";

/** Default "log" color */
const _COLOR_LOG = null;

/** Default "info" color */
const _COLOR_INFO = "cyan";

/** Default "warn" color */
const _COLOR_WARN = "orange";

/** Default "error" color */
const _COLOR_ERROR = "red";

/** colors are enabled by default in "browser" and in "deno", NOT in "node" (as it does
 * not support the %c format). Note that this flags only effects the "%c" formatting, not
 * terminal string colors */
const _COLORS = ["browser", "deno"].includes(_detectRuntime());

// default globals
const _CONFIG: ClogConfigFlags = {
	debug: true,
	log: true,
	info: true,
	warn: true,
	error: true,
	//
	dateTime: false,
	time: false,
	//
	colors: _COLORS,
	//
	debugColor: _COLOR_DEBUG,
	logColor: _COLOR_LOG,
	infoColor: _COLOR_INFO,
	warnColor: _COLOR_WARN,
	errorColor: _COLOR_ERROR,
};

const _DISABLED = false;

const _WRITER = null;

/** Will create a logger with provided "namespace". */
export function createClog(
	ns: string | false,
	config?: Partial<ClogConfigFlags> | boolean | null,
	writer?: Partial<Writer> | null,
	argsFilter?: null | ((clogArgs: any[]) => any[])
): Clog {
	const _logFn =
		(k: keyof Writer) =>
		(...args: any[]): Clog => {
			console[k](...args);
			return clog;
		};
	writer ??= {
		debug: _logFn("debug"),
		log: _logFn("log"),
		info: _logFn("info"),
		warn: _logFn("warn"),
		error: _logFn("error"),
	};

	const _rawNsBkp = ns;

	// explicit false means no "namespace"
	ns = ns !== false ? `[${ns}]` : "";

	// if we're passing in some object configuration, make sure it inherits the defaults
	if (config && typeof config !== "boolean") {
		// we may have used the special case "all" key shortcut
		const all = config.all !== undefined ? _confObj(!!config.all) : {};
		delete config.all;

		// start with defaults, may merge with "all", and finally merge with locals
		config = { ..._CONFIG, ...all, ...config };
	}

	// if undef, use global config
	config ??= Object.assign({}, createClog.CONFIG);

	// if boolean was provided
	if (config === true) config = _confObj(true);
	if (config === false) config = _confObj(false);

	//
	let _color: string | null = null;

	const _apply = (k: keyof Writer, args: any[]) => {
		// maybe master flag disabled
		if (createClog.DISABLED) return clog;

		// maybe local instance config disabled
		if (!config[k]) return clog;

		// acquire writer (global has priority)
		let w = writer;
		if (createClog.WRITER) w = createClog.WRITER;

		// maybe writer does not support current log method
		if (!w[k]) return clog;

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

		// console color formatting experimental dance
		const colorMark = "%c";

		// let's see if we have a config color for current k
		const colorKey: ClogColorConfigKey = `${k}Color`;
		let __color = _color ?? config[colorKey];

		// maybe colors are disabled
		if (!config.colors || !createClog.COLORS) __color = null;

		// we have a "global" color, so need to adjust args
		if (__color) {
			args[0] = colorMark + args[0];
			args.splice(1, 0, `color:${__color}`);
		} // we do not have a "global" color, let's see if:
		else if (
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

			// if we have passed exactly "%c" as the actual arg (legit) need to clean up
			// the empty string fragment
			if (args[2] === "") args.splice(2, 1);
		}

		// actual log finally...
		w[k]?.(...args);

		return clog;
	};

	const clog = (...args: any[]) => _apply("log", args);
	clog.debug = (...args: any[]) => _apply("debug", args);
	clog.info = (...args: any[]) => _apply("info", args);
	clog.warn = (...args: any[]) => _apply("warn", args);
	clog.error = (...args: any[]) => _apply("error", args);
	clog.log = clog;

	clog.color = (color: string | null) => {
		_color = color;
		return clog;
	};

	clog.ns = _rawNsBkp;
	clog.colors = !!config.colors;

	// make sure these are readonly (to avoid potential confusion)
	["color", "ns", "colors"].forEach((k) => {
		Object.defineProperty(clog, k, { writable: false });
	});

	return clog;
}

/** Global config */
createClog.CONFIG = _CONFIG as Partial<ClogConfigFlags> | boolean;

/** Master global `disabled` switch. If truthy, every instance will become no-op. */
createClog.DISABLED = _DISABLED as boolean;

/** Master global Writer */
createClog.WRITER = _WRITER as Partial<Writer> | null;

/** Master dis/enabler of colored output */
createClog.COLORS = _COLORS as boolean;

/** Resets globals to default, out-of-the-box state. Needed for tests. */
createClog.reset = (): void => {
	createClog.CONFIG = _CONFIG;
	createClog.DISABLED = _DISABLED;
	createClog.WRITER = _WRITER;
	createClog.COLORS = _COLORS;
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

/** Internal DRY util - creates prefilled config object */
function _confObj(v = true): ClogConfigFlags {
	return {
		..._CONFIG,
		debug: v,
		log: v,
		info: v,
		warn: v,
		error: v,
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

/** Will check if value is a plain object */
function _isPlainObject(v: any): boolean {
	return (
		v !== null &&
		typeof v === "object" &&
		[undefined, Object].includes(v.constructor)
	);
}

/** Will try to detect current runtime. */
function _detectRuntime(): "browser" | "node" | "deno" | "unknown" {
	if (typeof window !== "undefined" && (window as any)?.document) {
		return "browser";
	}
	if (globalThis.Deno?.version?.deno) return "deno"; // deno must come above node
	if ((globalThis as any).process?.versions?.node) return "node";
	return "unknown";
}
