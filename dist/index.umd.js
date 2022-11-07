(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, factory(global.clog = {}));
})(this, (function (exports) {
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

	  // explicit false => no "namespace"
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
	  const apply = (k, args) => {
	    var _config;
	    return ((_config = config) == null ? void 0 : _config[k]) && writer[k].apply(writer, ns ? [ns, ...args] : [...args]);
	  };
	  const clog = (...args) => apply('log', args);
	  clog.warn = (...args) => apply('warn', args);
	  clog.error = (...args) => apply('error', args);
	  clog.log = clog;
	  return clog;
	};

	exports.ClogConfig = ClogConfig;
	exports.createClog = createClog;

}));
