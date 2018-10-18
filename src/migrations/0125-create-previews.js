var mongodb = require('mongodb'),
    async = require('async');

exports.up = function(db, next) {
    var docsCollection = mongodb.Collection(db, 'documents'),
        tasks = mongodb.Collection(db, 'tasks');

    docsCollection.find({}, function(err, cursor) {
        if (err) {
            return next(err);
        }

        cursor.toArray(function(err, docsArray) {
            if (err) {
                return next(err);
            }

            async.each(docsArray, function(doc, stepDone) {
                tasks.insert({
                    type: 'pageCount',
                    doc: doc._id,
                    user: doc.user.toJSON(),
                    priority: 2,
                    status: 'ready',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    retries: 0,
                    config: {
                        dataMigrationGeneratePreviews: true, // this uses special code in the 'pageCount' and 'scan' tasks
                        previewKey: doc.storageKey + 'preview/',
                        documentKey: doc.storageKey + 'file/' + doc.fileName,
                        documentRegion: doc.storageRegion,
                        documentBucket: doc.storageBucket
                    }
                }, function(err) {
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
