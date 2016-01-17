'use strict';

const should = require('should');

const vaccinate = require('../lib/');

describe('vaccinate', () => {
	it('invokes the function passed in', () => {
		var called = false;
		function someFunc () {
			called = true;
		}
		someFunc.$vaccinations = [];

		vaccinate(someFunc);
		should(called).be.true();
	});

	it('injects the vaccinations', () => {
		var loggerArg;
		function someFunc (logger) {
			loggerArg = logger;
		}
		someFunc.$vaccinations = [__dirname + '/modules/logger'];

		vaccinate(someFunc);
		should(loggerArg).equal(require('./modules/logger'));
	});

	it('supports recursive vaccinations', () => {
		var userArg, loggerArg;
		function someFunc (User, logger) {
			userArg = User;
			loggerArg = logger;
		}
		someFunc.$vaccinations = [__dirname + '/modules/user', __dirname + '/modules/logger'];

		vaccinate(someFunc);
		should(userArg).eql(require('./modules/user')(require('./modules/logger')));
		should(loggerArg).equal(require('./modules/logger'));
	});

	it('passes modules directly through if they are not strings', () => {
		var someModuleArg;
		function someFunc (someModule) {
			someModuleArg = someModule;
		}
		var someModule = {};
		someFunc.$vaccinations = [someModule];

		vaccinate(someFunc);
		should(someModuleArg).equal(someModule);
	});

	it('allows the dependencies property to be overridden', () => {
		var loggerArg;
		function someFunc (logger) {
			loggerArg = logger;
		}
		someFunc.inject = [__dirname + '/modules/logger'];

		vaccinate(someFunc, {dependenciesProperty: 'inject'});
		should(loggerArg).equal(require('./modules/logger'));
	});

	it('resolves relative paths to the moduleDir option', () => {
		var loggerArg, lodashArg;
		function someFunc (logger, lodash) {
			loggerArg = logger;
			lodashArg = lodash;
		}
		someFunc.$vaccinations = ['./logger', 'lodash'];

		vaccinate(someFunc, {moduleDir: __dirname + '/modules'});
		should(loggerArg).equal(require('./modules/logger'));
		should(lodashArg).equal(require('lodash'));
	});

	it('supports multiple moduleDir values', () => {
		var loggerArg;
		function someFunc (logger) {
			loggerArg = logger;
		}
		someFunc.$vaccinations = ['./logger'];

		vaccinate(someFunc, {moduleDir: [
			__dirname + '/modules', __dirname + '/modules/not-here'
		]});
		should(loggerArg).equal(require('./modules/logger'));
	});

	it('uses the first moduleDir value that works', () => {
		var loggerArg;
		function someFunc (logger) {
			loggerArg = logger;
		}
		someFunc.$vaccinations = ['./logger'];

		vaccinate(someFunc, {moduleDir: [
			__dirname + '/modules/not-here', __dirname + '/modules/also-here', __dirname + '/modules'
		]});
		should(loggerArg).equal(require('./modules/also-here/logger'));
	});

	it('allows the require function to be overridden', () => {
		var loggerArg;
		function someFunc (logger) {
			loggerArg = logger;
		}
		someFunc.$vaccinations = ['logger'];

		var logger = {};
		vaccinate(someFunc, {
			require: (module, options) => {
				if (module === 'logger') {
					return logger;
				} else {
					throw new Error('Module not found');
				}
			}
		});
		should(loggerArg).equal(logger);
	});

	it('allows defaults to be overridden', () => {
		vaccinate.defaults.moduleDir = __dirname + '/modules';

		var loggerArg, lodashArg;
		function someFunc (logger, lodash) {
			loggerArg = logger;
			lodashArg = lodash;
		}
		someFunc.$vaccinations = ['./logger', 'lodash'];

		vaccinate(someFunc);
		should(loggerArg).be.Object();
		should(lodashArg.assign).be.Function();

		delete vaccinate.defaults.moduleDir;
	})

	function createUser (User, logger) {
		return (formData) => {
			var user = new User(formData);
			user.save();
			logger.log('New user created with ID ' + user.id);
		};
	}
	createUser.$vaccinations = [__dirname + '/modules/user', __dirname + '/modules/logger'];

});
