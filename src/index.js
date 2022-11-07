export class ClogConfig {
	static log = true;
	static warn = true;
	static error = true;

	static none() {
		ClogConfig.log = false;
		ClogConfig.warn = false;
		ClogConfig.error = false;
	}

	static all() {
		ClogConfig.log = true;
		ClogConfig.warn = true;
		ClogConfig.error = true;
	}
}

export const createClog = (ns, config = ClogConfig, writer = null) => {
	writer ||= console;
	if (ns !== false) ns = `[${ns}]`;

	// explicit true/false shortcuts
	if (config === true) config = { log: true, warn: true, error: true };
	if (config === false) config = { log: false, warn: false, error: false };

	const clog = (...args) =>
		config?.log && writer.log.apply(writer, ns ? [ns, ...args] : [...args]);

	clog.warn = (...args) =>
		config?.warn && writer.warn.apply(writer, ns ? [ns, ...args] : [...args]);

	clog.error = (...args) =>
		config?.error && writer.error.apply(writer, ns ? [ns, ...args] : [...args]);

	clog.log = clog;

	return clog;
};
