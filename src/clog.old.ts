interface ConfigFlags {
	debug: boolean;
	log: boolean;
	info: boolean;
	warn: boolean;
	error: boolean;
	//
	dateTime?: boolean;
	time?: boolean;
}

interface Writer {
	(...args): any;
	debug: CallableFunction;
	log: CallableFunction;
	info: CallableFunction;
	warn: CallableFunction;
	error: CallableFunction;
}

const _confObj = (v = true): ConfigFlags => ({
	debug: v,
	log: v,
	info: v,
	warn: v,
	error: v,
	dateTime: false,
	time: false,
});

function _moveArrayElement(arr: any[], fromIndex: number, toIndex: number): any[] {
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

export function createClog(
	ns: string | false,
	config: boolean | ConfigFlags = null,
	writer: Writer = null,
	filter: CallableFunction = null,
): Writer {
	writer ||= console as any;

	// explicit false means no "namespace"
	if (ns !== false) ns = `[${ns}]`;

	// default is global, also support for boolean shortcuts
	if (config === null) config = createClog.CONFIG;
	if (config === true) config = _confObj(true);
	if (config === false) config = _confObj(false);

	const apply = (k, args) => {
		let w = writer;
		if (createClog.CONFIG?.WRITER) w = createClog.CONFIG.WRITER;
		if (
			createClog.CONFIG?.MASTER !== false &&
			(createClog.CONFIG?.MASTER || config?.[k])
		) {
			if (typeof filter === "function") {
				args = filter(args);
			}

			let _ns = ns;

			//
			if (typeof config !== "boolean" && (config?.dateTime || config?.time)) {
				const iso = new Date().toISOString();
				if (config?.dateTime) {
					_ns = `[${iso.replace("T", " ")}] ${_ns}`;
				} else if (config?.time) {
					_ns = `[${iso.slice("YYYY-MM-DDT".length)}] ${_ns}`;
				}
			}

			args = _ns ? [_ns, ...args] : [...args];

			// browser style colored?
			const colorMark = "%c";
			if (
				typeof args[1] === "string" &&
				args[1]?.startsWith(colorMark) &&
				args[2]
			) {
				args[0] = colorMark + args[0];
				args[1] = args[1].slice(colorMark.length);
				args = _moveArrayElement(args, 2, 1);
			}

			// w[k].apply(w, ns ? [ns, ...args] : [...args]);
			w[k].apply(w, [...args]);
		}
	};

	const clog = (...args) => apply("log", args);
	clog.debug = (...args) => apply("debug", args);
	clog.info = (...args) => apply("info", args);
	clog.warn = (...args) => apply("warn", args);
	clog.error = (...args) => apply("error", args);
	clog.log = clog;

	clog.ns = ns;

	return clog;
}

export const clogFilterStringifier = (args) =>
	args.map((a) => {
		if (typeof a === "string" || a?.toString?.() !== "[object Object]") return a;
		return JSON.stringify(a, null, 4);
	});

// stringified version
export const createClogStr = (
	ns,
	config: boolean | ConfigFlags = null,
	writer: Writer = null,
) => createClog(ns, config, writer, clogFilterStringifier);

createClog.CONFIG = {
	debug: true,
	log: true,
	info: true,
	warn: true,
	error: true,
	//
	dateTime: false,
	time: false,

	// highest priority master switch, only if defined as boolean
	// will be ignored if null/undef
	MASTER: null,

	// master global writer
	WRITER: null,

	none: () => Object.assign(createClog.CONFIG, _confObj(false)),

	all: () => Object.assign(createClog.CONFIG, _confObj(true)),

	reset: () => {
		createClog.CONFIG.all();
		createClog.CONFIG.MASTER = null;
		createClog.CONFIG.WRITER = null;
	},
};
