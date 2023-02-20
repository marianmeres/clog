interface ConfigFlags {
	debug: boolean;
	log: boolean;
	info: boolean;
	warn: boolean;
	error: boolean;
}

interface Writer {
	(...args): any;
	debug: Function;
	log: Function;
	info: Function;
	warn: Function;
	error: Function;
}

const _confObj = (v = true): ConfigFlags => ({
	debug: v,
	log: v,
	info: v,
	warn: v,
	error: v,
});

export function createClog(
	ns,
	config: boolean | ConfigFlags = null,
	writer: Writer = null,
	filter: Function = null
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
			if (typeof filter === 'function') {
				args = filter(args);
			}
			w[k].apply(w, ns ? [ns, ...args] : [...args]);
		}
	};

	const clog = (...args) => apply('log', args);
	clog.debug = (...args) => apply('debug', args);
	clog.info = (...args) => apply('info', args);
	clog.warn = (...args) => apply('warn', args);
	clog.error = (...args) => apply('error', args);
	clog.log = clog;

	return clog;
}

createClog.CONFIG = {
	debug: true,
	log: true,
	info: true,
	warn: true,
	error: true,

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
