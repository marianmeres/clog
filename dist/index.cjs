'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const _confObj = (v = true) => ({
    debug: v,
    log: v,
    info: v,
    warn: v,
    error: v,
});
const createClog = (ns, config = null, writer = null) => {
    writer ||= console;
    if (createClog.CONFIG?.WRITER)
        writer = createClog.CONFIG.WRITER;
    if (ns !== false)
        ns = `[${ns}]`;
    if (config === null)
        config = createClog.CONFIG;
    if (config === true)
        config = _confObj(true);
    if (config === false)
        config = _confObj(false);
    const apply = (k, args) => {
        if (createClog.CONFIG?.MASTER !== false && (createClog.CONFIG?.MASTER || config?.[k])) {
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
createClog.CONFIG = {
    debug: true,
    log: true,
    info: true,
    warn: true,
    error: true,
    MASTER: null,
    WRITER: null,
    none: () => Object.assign(createClog.CONFIG, _confObj(false)),
    all: () => Object.assign(createClog.CONFIG, _confObj(true)),
    reset: () => {
        createClog.CONFIG.all();
        createClog.CONFIG.MASTER = null;
        createClog.CONFIG.WRITER = null;
    }
};

exports.createClog = createClog;
