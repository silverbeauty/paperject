var mongodb = require('mongodb');

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'documents');

    collection.update({}, {
        $rename: {
            'author': 'user'
        }
    }, {
        multi: true
    }, function(err) {
        if (err) {
            next(err);
            return;
        }

        collection.dropIndex({
            author: 1
        }, function(err) {
            if (err) {
                next(err);
                return;
            }

            collection.ensureIndex({
                user: 1
            }, next);
        });

    });
};

exports.down = function(db, next) {
    var collection = mongodb.Collection(db, 'documents');

    collection.update({}, {
        $rename: {
            'user': 'author'
        }
    }, {
        multi: true
    }, function(err) {
        if (err) {
            next(err);
            return;
        }

        collection.dropIndex({
            user: 1
        }, function(err) {
            if (err) {
                next(err);
                return;
            }

            collection.ensureIndex({
                author: 1
            }, next);
        });

    });
};
