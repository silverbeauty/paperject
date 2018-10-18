var mongodb = require('mongodb');

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'pages');

    collection.ensureIndex({
        doc: 1
    }, function(err) {
        if (err) {
            return next(err);
        }

        next();
    });
};

exports.down = function(db, next) {
    var collection = mongodb.Collection(db, 'pages');

    collection.dropIndex({
        doc: 1
    }, function(err) { // ignore errors
        next();
    });
};
