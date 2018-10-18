var mongodb = require('mongodb');

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'documents');

    collection.ensureIndex({
        author: 1
    }, next);
};

exports.down = function(db, next) {
    var collection = mongodb.Collection(db, 'documents');

    collection.dropIndex({
        author: 1
    }, function(err) { // ignore errors
        next();
    });
};
