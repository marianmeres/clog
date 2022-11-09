const _confObj = (v = true) => ({
    debug: v,
    log: v,
    info: v,
    warn: v,
    error: v,
});
class ClogConfig {
    static debug = true;
    static log = true;
    static info = true;
    static warn = true;
    static error = true;
    static MASTER = null;
    static none() {
        Object.assign(ClogConfig, _confObj(false));
    }
    static all() {
        Object.assign(ClogConfig, _confObj(true));
    }
}
const createClog = (ns, config = null, writer = null) => {
    writer ||= console;
    if (ns !== false)
        ns = `[${ns}]`;
    if (config === null)
        config = ClogConfig;
    if (config === true)
        config = _confObj(true);
    if (config === false)
        config = _confObj(false);
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

export { ClogConfig, createClog };
