'use strict';

const _ = require('lodash');

/**
 * Invokes `func`, requiring and passing in dependencies it specifies
 * @param {Function} func The function to inject dependencies into. It must have a property listing its dependencies
 * @param {object} [options] Overrides to the default options
 * @param {string} [options.dependenciesProperty] The name of the property on `func` that is an array of modules.
 *   Default: `$vaccinations`
 * @param {string|[string]} [options.moduleDir] Absolute path to prepend to module names that begin with `./`. If array
 *   is passed, the first module directory that contains the module with the given name is used
 * @param {Function} [options.require] The function to require a module. Accepts the module to require and the options
 *   object. By default, if the module is a string, it is required and recursively vaccinated; otherwise, its value is
 *   simply returned
 * @returns {*} The result of invoking `func`
 */
function vaccinate (func, options) {
	options = options || {};
	_.defaults(options, vaccinate.defaults);

	var args = func[options.dependenciesProperty].map((module) => options.require(module, options));

	return func.apply(null, args);
};

vaccinate.defaults = {
	dependenciesProperty: '$vaccinations',
	require: (module, options) => {
		if (typeof module !== 'string') return module;

		var dependency;
		if (options.moduleDir && _.startsWith(module, './')) {
			var moduleDirs = typeof options.moduleDir === 'string' ? [options.moduleDir] : options.moduleDir;
			var ex;
			moduleDirs.some((moduleDir) => {
				try {
					dependency = require(moduleDir + '/' + module);
					ex = null;
					return true;
				} catch (_ex) {
					ex = _ex;
					return false;
				}
			});

			if (ex) throw ex;
		} else {
			dependency = require(module);
		}

		if (typeof dependency === 'function' && Array.isArray(dependency[options.dependenciesProperty])) {
			dependency = vaccinate(dependency, options);
		}

		return dependency;
	}
};

module.exports = vaccinate;
