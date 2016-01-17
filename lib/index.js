'use strict';

const _ = require('lodash');

/**
 * Invokes `func`, requiring and passing in dependencies it specifies
 * @param {Function} func The function to inject dependencies into. It must have a property listing its dependencies
 * @param {object} [options] Overrides to the default options
 * @param {string} [options.dependenciesProperty] The name of the property on `func` that is an array of modules.
 *   Default: `$vaccinations`
 * @param {string} [options.moduleDir] Absolute path to prepend to module names that begin with `./`
 * @param {Function} [options.require] The function to require a module. Accepts the module to require and the options
 *   object. By default, if the module is a string, it is required and recursively vaccinated; otherwise, its value is
 *   simply returned
 * @param {object} [context] Context (`this` value) to invoke `func` with
 * @returns {*} The result of invoking `func`
 */
function vaccinate (func, options, context) {
	options = options || {};
	_.defaults(options, vaccinate.defaults);

	var args = func[options.dependenciesProperty].map((module) => options.require(module, options));

	return func.apply(context || null, args);
};

vaccinate.defaults = {
	dependenciesProperty: '$vaccinations',
	require: (module, options) => {
		if (typeof module !== 'string') return module;

		if (options.moduleDir && _.startsWith(module, './')) module = options.moduleDir + '/' + module;
		var dependency = require(module);

		if (typeof dependency === 'function' && Array.isArray(dependency[options.dependenciesProperty])) {
			dependency = vaccinate(dependency, options);
		}

		return dependency;
	}
};

module.exports = vaccinate;
