'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const _confObj = (v = true) => ({
    debug: v,
    log: v,
    info: v,
    warn: v,
    error: v,
});
function createClog(ns, config = null, writer = null, filter = null) {
    writer ||= console;
    if (ns !== false)
        ns = `[${ns}]`;
    if (config === null)
        config = createClog.CONFIG;
    if (config === true)
        config = _confObj(true);
    if (config === false)
        config = _confObj(false);
    const apply = (k, args) => {
        let w = writer;
        if (createClog.CONFIG?.WRITER)
            w = createClog.CONFIG.WRITER;
        if (createClog.CONFIG?.MASTER !== false &&
            (createClog.CONFIG?.MASTER || config?.[k])) {
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
const clogFilterStringifier = (args) => args.map((a) => {
    if (typeof a === 'string' || a?.toString?.() !== '[object Object]')
        return a;
    return JSON.stringify(a, null, 4);
});
const createClogStr = (ns, config = null, writer = null) => createClog(ns, config, writer, clogFilterStringifier);
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
    },
};

exports.clogFilterStringifier = clogFilterStringifier;
exports.createClog = createClog;
exports.createClogStr = createClogStr;
