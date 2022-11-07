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

  // explicit true/false shortcuts
  if (config === true) config = {
    log: true,
    warn: true,
    error: true
  };
  if (config === false) config = {
    log: false,
    warn: false,
    error: false
  };
  const clog = (...args) => {
    var _config;
    return ((_config = config) == null ? void 0 : _config.log) && writer.log.apply(writer, ns ? [ns, ...args] : [...args]);
  };
  clog.warn = (...args) => {
    var _config2;
    return ((_config2 = config) == null ? void 0 : _config2.warn) && writer.warn.apply(writer, ns ? [ns, ...args] : [...args]);
  };
  clog.error = (...args) => {
    var _config3;
    return ((_config3 = config) == null ? void 0 : _config3.error) && writer.error.apply(writer, ns ? [ns, ...args] : [...args]);
  };
  clog.log = clog;
  return clog;
};

export { ClogConfig, createClog };
