'use strict';

var id = 0;

module.exports = (logger) => {
	return class User {
		constructor (formData) {
			this.formData = formData;
			logger.log('Created user with formData: ' + JSON.stringify(formData));
		}

		save () {
			this.id = ++id;
		}
	};
};
module.exports.$vaccinations = [__dirname + '/logger'];
