var mongodb = require('mongodb'),
    newIndex = {
        status: 1,
        priority: -1,
        updatedAt: 1
    },
    oldIndex = {
        inProgress: -1,
        priority: -1,
        updatedAt: 1
    };

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'tasks');

    collection.dropIndex(oldIndex, function(err) {
        if (err) {
            return next(err);
        }

        collection.ensureIndex(newIndex, function(err) {
            if (err) {
                return next(err);
            }

            console.log('Created index ' + JSON.stringify(newIndex));
            next();
        });
    });
};

exports.down = function(db, next) {
    var collection = mongodb.Collection(db, 'tasks');

    collection.dropIndex(newIndex, function(err) {
        if (err) {
            return next(err);
        }

        collection.ensureIndex(oldIndex, function(err) {
            if (err) {
                return next(err);
            }

            console.log('Created index ' + JSON.stringify(oldIndex));
            next();
        });
    });
};
