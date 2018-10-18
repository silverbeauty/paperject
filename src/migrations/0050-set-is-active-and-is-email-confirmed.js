var mongodb = require('mongodb');

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'users');
    collection.update({
        isEmailConfirmed: {
            $exists: false
        }
    }, {
        $set: {
            isEmailConfirmed: true
        }
    }, {
        multi: true
    }, function(err) {
        if (err) {
            next(err);
        } else {
            collection.update({
                isActive: {
                    $exists: false
                }
            }, {
                $set: {
                    isActive: true
                }
            }, {
                multi: true
            }, function(err) {
                next(err);
            });
        }
    });
};

exports.down = function(db, next) {
    next();
};
