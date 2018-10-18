var mongodb = require('mongodb'),
    index = {
        inProgress: -1,
        priority: -1,
        updatedAt: 1
    };

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'tasks');

    collection.ensureIndex(index, function(err) {
        console.log('Created index ' + JSON.stringify(index));
        if (err) {
            return next(err);
        }

        next();
    });
};

exports.down = function(db, next) {
    var collection = mongodb.Collection(db, 'tasks');

    collection.dropIndex(index, function(err) { // ignore errors
        next();
    });
};
