var mongodb = require('mongodb'),
    async   = require('async');

exports.up = function(db, next){
    var collection = mongodb.Collection(db, 'users');

    collection.find({
        'metrics.uploadQuota': {
            $exists: false
        }
    }, function(err, cursor) {
        if (err) {
            return next(err);
        }

        cursor.toArray(function(err, users){
            if (err) {
                return next(err);
            }

            async.each(users, function(user, stepDone){
                collection.update({
                    _id: user._id
                }, {
                    $set: {
                        'metrics.uploadQuota': 10
                    }
                }, function(err) {
                    stepDone(err);
                });
            }, function(err){
                next(err);
            });
        });
    });
};

exports.down = function(db, next){
    next();
};
