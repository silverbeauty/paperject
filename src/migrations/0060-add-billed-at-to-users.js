var mongodb = require('mongodb');

exports.up = function(db, next){
    var collection = mongodb.Collection(db, 'users');

    collection.find({
        billedAt: {
            $exists: false
        }
    }).toArray(function(err, users){
        var cnt = users.length;
        if (!cnt) {
            return next();
        }
        users.forEach(function (user) {
            if (user){
                collection.update({
                    _id: user._id
                }, {
                    $set: {
                        billedAt: user.createdAt
                    }
                }, {
                    multi: false
                }, function(err) {
                    if(--cnt === 0){
                        next();
                    }
                });
            }

        });
    });
};

exports.down = function(db, next){
    next();
};
