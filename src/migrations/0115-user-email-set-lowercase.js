var mongodb = require('mongodb'),
    async = require('async');

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'users');

    collection.find({
        'email': /[A-Z]/
    }, function(err, cursor) {
        if (err) {
            return next(err);
        }

        cursor.toArray(function(err, users) {
            if (err) {
                return next(err);
            }

            async.each(users, function(user, stepDone) {
                collection.update({
                    _id: user._id
                }, {
                    $set: {
                        email: user.email.toLowerCase()
                    }
                }, function(err) {
                    console.log('Updated ' + user.email);
                    stepDone(err);
                });
            }, function(err) {
                next(err);
            });
        });
    });
};

exports.down = function(db, next) {
    next();
};
