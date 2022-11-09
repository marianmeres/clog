interface ConfigFlags {
	debug: boolean;
	log: boolean;
	info: boolean;
	warn: boolean;
	error: boolean;
}

interface Writer {
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

export class ClogConfig {
	static debug = true;
	static log = true;
	static info = true;
	static warn = true;
	static error = true;

	// highest priority master switch, only if defined as boolean
	// will be ignored if null/undef
	static MASTER = null;

	static none() {
		Object.assign(ClogConfig, _confObj(false));
	}

	static all() {
		Object.assign(ClogConfig, _confObj(true));
	}
}

export const createClog = (
	ns,
	config: boolean | ConfigFlags = null,
	writer: Writer = null
): Writer => {
	writer ||= console;

	// explicit false means no "namespace"
	if (ns !== false) ns = `[${ns}]`;

	// default is global, also support for boolean shortcuts
	if (config === null) config = ClogConfig;
	if (config === true) config = _confObj(true);
	if (config === false) config = _confObj(false);

	const apply = (k, args) => {
		if (ClogConfig.MASTER !== false && (ClogConfig.MASTER || config?.[k])) {
			writer[k].apply(writer, ns ? [ns, ...args] : [...args]);
		}
	};

	const clog = (...args) => apply('log', args);
	clog.debug = (...args) => apply('debug', args);
	clog.info = (...args) => apply('info', args);
	clog.warn = (...args) => apply('warn', args);
	clog.error = (...args) => apply('error', args);
	clog.log = clog;

	return clog;
};
