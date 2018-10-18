var mongodb = require('mongodb');

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'folders');

    collection.insert({
        updatedAt: new Date(),
        createdAt: new Date(),
        isSystemFolder: true,
        alias: 'inbox',
        displayOrder: 2,
        name: 'Inbox'
    }, {}, function(err) {
        if (err) {
            next(err);
            return;
        }

        collection.update({
            alias: 'trash'
        }, {
            $set: {
                displayOrder: 3
            }
        }, {
            multi: true
        }, next);
    });
};

exports.down = function(db, next) {
    var collection = mongodb.Collection(db, 'folders');

    collection.findAndRemove({
        alias: 'inbox'
    }, {}, next);
};
