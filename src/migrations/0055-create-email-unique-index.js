var mongodb = require('mongodb');

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'users');

    collection.ensureIndex({
        email: 1
    }, {
        unique: true
    }, function(err) {
        if (err) {
            return next(err);
        }

        next();
    });
};

exports.down = function(db, next) {
    var collection = mongodb.Collection(db, 'users');

    collection.dropIndex({
        email: 1
    }, function(err) {
        next();
    });
};
