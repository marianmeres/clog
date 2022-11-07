'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

class ClogConfig {
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
const createClog = (ns, config = ClogConfig, writer = null) => {
    writer ||= console;
    if (ns !== false)
        ns = `[${ns}]`;
    if (config === true)
        config = { log: true, warn: true, error: true };
    if (config === false)
        config = { log: false, warn: false, error: false };
    const apply = (k, args) => config?.[k] && writer[k].apply(writer, ns ? [ns, ...args] : [...args]);
    const clog = (...args) => apply('log', args);
    clog.warn = (...args) => apply('warn', args);
    clog.error = (...args) => apply('error', args);
    clog.log = clog;
    return clog;
};

exports.ClogConfig = ClogConfig;
exports.createClog = createClog;
