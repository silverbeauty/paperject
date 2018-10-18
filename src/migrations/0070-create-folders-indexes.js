var mongodb = require('mongodb');

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'folders');

    collection.ensureIndex({
        isSystemFolder: 1
    }, function(err) {
        if (err) {
            return next(err);
        }

        collection.ensureIndex({
            user: 1
        }, next);
    });
};

exports.down = function(db, next) {
    var collection = mongodb.Collection(db, 'folders');

    collection.dropIndex({
        isSystemFolder: 1
    }, function(err) { // ignore errors
        collection.dropIndex({
            user: 1
        }, function(err) { // ignore errors
            next();
        });
    });
};
