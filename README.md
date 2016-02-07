# vaccinate

Vaccinate is an inversion of control (IoC) module that is probably too simple to qualify as actual IoC, but may require
the lowest learning curve or adjustments to existing code. It is a very simple design pattern in which, instead of
exporting the value that the developer would have for a particular module, he/she instead exports a function that
returns the value. The function accepts as parameters its various dependencies, which allows the developer to override
these dependencies in unit tests. Vaccinate only works in environments where modules can be loaded synchronously (i.e.
by `require()`) and does not support circular dependencies by default.

## The Problem

Consider this class that represents a User record. It features a `save` method that either inserts or updates a user
record in the database, depending on its way of detecting if the user is new or existing.

```js
// models/user.js
const dbConnection = require('../db-connection');
module.exports = class User {
  constructor (formData) {
    this.formData = formData;
  }
  
  save (callback) {
    if (!this.id) {
      dbConnection.insert(this.formData, callback);
    } else {
      dbConnection.update({id: this.id}, this.formData, callback);
    }
  }
};

// app.js
const User = require('./models/user');

var user = new User({email: 'some email'});
user.save((err) => {
  if (err) throw err;
  console.log('User created!');
});
```

You may want to write a unit test verifying that the `save` function correctly chooses whether to insert or to update
the record, but you don't want your test runner to actually create or update a record in your real database! You want to
mock your database connection with a fake instance. With the way that this code is written, the only way to do that is
to clutter up `db-connection.js` with some "if" condition checking to see if the current environment is the test
environment. But you want to keep your test-related code in your test files, not scattered throughout the app.

## The Solution

One of the simplest ways to solve this problem is via *inversion of control*, where the module being tested (the User
model) does not control its dependencies (the database connection), but rather the dependency is passed in by the
module's user (the app). This is done by having the module export a function that returns what it normally would export,
and this function accepts as arguments its dependencies.

```js
// models/user.js
module.exports = (dbConnection) => {
  return class User {
    constructor (formData) {
      this.formData = formData;
    }
  
    save (callback) {
      if (!this.id) {
        dbConnection.insert(this.formData, callback);
      } else {
        dbConnection.update({id: this.id}, this.formData, callback);
      }
    }
  };
};

// app.js
const dbConnection = require('./db-connection');
const User = require('./models/user')(dbConnection);

var user = new User({email: 'some email'});
user.save((err) => {
  if (err) throw err;
  console.log('User created!');
});
```

With this setup, a unit test can easily mock the database connection in order to observe which method is being called by
`save`, without performing any database interactions.

```js
// tests/models/user.js
const User = require('../models/user')({
  insert: (data, callback) => { ... },
  update: (criteria, data, callback) => { ... }
});

describe('User', () => {
  ...
});
```

This is a solid design pattern; however, without any framework managing dependencies, it requires the developer to
constantly reference the module's list of dependencies and update the arguments passed in whenever that module is being
used (e.g. if the `User` module later needs the `fs` package to write to a filesystem log as well, `app.js` needs to be
updated to pass in `require('fs')` after `dbConnection`).

## Using Vaccinate

### Simple Example

You can install Vaccinate in your app by running `npm install vaccinate`.

Vaccinate uses this same pattern and adds just a little bit of flavor -- it simply injects the dependencies as they
usually would resolve to be.

```js
// models/user.js
module.exports = (dbConnection) => {
  class User {
    ...
  };
};
module.exports.$vaccinations = [__dirname + '../db-connection'];

// app.js
const vaccinate = require('vaccinate');
const User = vaccinate(require('./models/user'));
```

All that Vaccinate does is iterate through each value in the `$vaccinations` array, `require()` it, and invoke the
function, passing in the dependencies as arguments. The app calls `vaccinate()` on the module to inject dependencies,
while the tests don't use Vaccinate at all, or they override how Vaccinate requires dependencies and pass different
values in.

### vaccinate (func [, options])

The `vaccinate()` function accepts two parameters:

* *Function* `func`: The IoC'd function to invoke with the dependencies
* *object* `options`: A hash of options (optional)
  * *string* `dependenciesProperty`: The name of the array of dependency names. **Default:** `'$vaccinations'`
  * *string|[string]* `moduleDir`: The *absolute* path to where Vaccinate should look in to find modules whose names
    begin with `./`. For instance, if Vaccinate is used in `app.js` in your project root and this value is
    `__dirname + '/modules'`, then regardless of the location of `user.js`, `./db-connection` will *always* resolve to
    `[project root]/modules/db-connection.js`. If this value is an array, each directory is tried and the first to
     resolve with the module name is used. **Default:** *None*
  * *Function* `require`: The function that accepts a dependency name and the options hash and returns the dependency.
Generally this function is useful to override in your unit test suite. **Default:** By default, this function will
prepend the module name with the value of `options.moduleDir` if it begins with `./`, then invoke `require()` on it. If
the result of `require()` is a function with a `options.dependenciesProperty` property on it, it will be recursively
vaccinated. If the dependency passed in is not a string, it will simply be returned.

### vaccinate.defaults

The default options can be overridden by setting the options listed above on `vaccinate.defaults`, e.g.
`vaccinate.defaults.moduleDir = __dirname + '/modules';`

### Complete Example Usage

```js
// app.js
const vaccinate = require('vaccinate');
vaccinate.defaults.moduleDir = __dirname + '/modules';
const User = vaccinate(require('./models/user'));

var user = new User({email: 'some email'});
user.save((err) => {
  if (err) throw err;
  console.log('User created!');
});

// models/user.js
module.exports = (dbConnection, fs) => {
  class User {
    constructor (formData) {
      this.formData = formData;
    }
    
    getDbConnection () {
      return dbConnection;
    }
  
    save (callback) {
      if (!this.id) {
        dbConnection.insert(this.formData, callback);
      } else {
        dbConnection.update({id: this.id}, this.formData, callback);
      }
      
      fs.appendFile('userlog.txt', '\nUser.save() called', (err) => { if (err) throw err; });
    }
  };
};
module.exports.$vaccinations = ['./dbConnection', 'fs'];

// modules/db-connection.js
module.exports = (mongodb, mongoConfig) => {
  var dbReady = new Promise((resolve, reject) => {
    mongodb.MongoClient.connect(mongoConfig.url, (err, db) => {
      if (err) throw err;
      resolve(db);
    });
  });
  
  return {
    insert: (record, callback) => {
      dbReady.then(() => {
        db.collection('users').insert(record, callback);
      });
    },
    update: (criteria, record, callback) => {
      dbReady.then(() => {
        db.collection('users').update(criteria, record, callback);
      });
    }
  };
};
module.exports.$vaccinations = ['mongodb', './mongo-config'];

// modules/mongo-config.js
module.exports = {
  url: 'mongodb://localhost:27017/myproject'
};

// tests/models/user.js
const vaccinate = require('vaccinate');
vaccinate.defaults.moduleDir = [__dirname + '/../mocks', __dirname + '/../../modules'];
const User = vaccinate(require('./models/user'));

describe('User', () => {
  describe('#save', () => {
    it('calls `insert` on the dbCollection when the user does not have an id', () => {
      var user = new User({});
      var spy = sinon.spy(user.getDbConnection(), 'insert');
      user.save(() => {});
      spy.called.should.equal.true;
    });
    
    it('calls `update` on the dbCollection when the user does have an id', () => {
      var user = new User({id: 1});
      var spy = sinon.spy(user.getDbConnection(), 'update');
      user.save(() => {});
      spy.called.should.equal.true;
    });
  });
});

// tests/mocks/db-connection.js
var id = 0;
module.exports = {
  insert: (data, callback) => {
    setTimeout(() => {
      data.id = ++id;
    }, 0);
  },
  update: (data, callback) => {
    setTimeout(callback, 0);
  }
};
```

## Testing

Vaccinate has a suite of Mocha tests in the `test/` directory. Run the tests by installing Vaccinate with its dev
dependencies and then running `npm test`.
