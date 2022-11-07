class ClogConfig {
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
ClogConfig.log = true;
ClogConfig.warn = true;
ClogConfig.error = true;
const createClog = (ns, config = ClogConfig, writer = null) => {
  writer || (writer = console);
  if (ns !== false) ns = `[${ns}]`;
  const clog = (...args) => (config == null ? void 0 : config.log) && writer.log.apply(writer, ns ? [ns, ...args] : [...args]);
  clog.warn = (...args) => (config == null ? void 0 : config.warn) && writer.warn.apply(writer, ns ? [ns, ...args] : [...args]);
  clog.error = (...args) => (config == null ? void 0 : config.error) && writer.error.apply(writer, ns ? [ns, ...args] : [...args]);
  clog.log = clog;
  return clog;
};

exports.ClogConfig = ClogConfig;
exports.createClog = createClog;
