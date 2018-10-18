var mongodb = require('mongodb');

exports.up = function(db, next) {
    var collection = mongodb.Collection(db, 'users'),
        migrateUsers = function(authType, authTokenField, callback) {
            var cursor = collection.find({
                    authType: authType
                }),
                updateNext = function(err, user) {
                    if (err) {
                        next(err);
                        return;
                    }

                    if (!user) {
                        callback();
                        return;
                    }

                    var obj = {};
                    obj[authTokenField] = user.authToken;

                    collection.update({
                        _id: user._id
                    }, {
                        $unset: {
                            authToken: true,
                            authType: true
                        },
                        $set: obj
                    }, function(err) {
                        if (err) {
                            next(err);
                            return;
                        }

                        cursor.nextObject(updateNext);
                    });
                };

            cursor.nextObject(updateNext);
        };

    migrateUsers('FB', 'fbProfileId', function() {
        migrateUsers('Google', 'googleProfileId', next);
    });
};

exports.down = function(db, next) {
    // cannot migrate down, because of data loss
    next();
};
