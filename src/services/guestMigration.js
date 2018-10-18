var mongoose = require('mongoose'),
    knox = require('knox'),
    winston = require('winston'),
    async = require('async'),
    config = require('../config')(),
    storage = require('../common/server/storage')(config);

module.exports = {
    migrateData: function(app, req, res, callback) {

        var guestId = req.signedCookies.guestId,
            saveDoc = function(doc, done) {
                async.parallel([
                    function(cb) {
                        doc.save(cb);
                    },
                    function(cb) {
                        mongoose.models.Task.remove({
                            doc: doc.id
                        }, cb);
                    },
                    function(cb) {
                        mongoose.models.Page.update({
                            doc: doc.id
                        }, {
                            user: req.user.id
                        }, {
                            multi: true
                        }, cb);
                    }
                ], function(err) {
                    if (err) {
                        done(err);
                        return;
                    }

                    findNextDocument(done);
                });
            },
            moveFile = function(doc, done) {
                var key = doc.get('fileKey'),
                    printKey = doc.get('printKey'),
                    bucket = doc.storageBucket,
                    region = doc.storageRegion;

                doc.storageBucket = config.s3.documentsBucket;
                doc.storageRegion = config.s3.documentsRegion;
                doc.user = req.user.id;
                doc.setStorageKey(config.s3.instancePrefix);

                storage.moveData(key, bucket, region, doc.get('fileKey'), doc.storageBucket, doc.storageRegion, function(err) {
                    if (err) {
                        done(err);
                        return;
                    }

                    storage.deleteKey(printKey, bucket, region);
                    saveDoc(doc, done);
                });
            },
            findNextDocument = function(done) {
                mongoose.models.Document.findOne({
                    user: guestId
                }, function(err, doc) {
                    if (err) {
                        done(err);
                        return;
                    }

                    if (!doc) {
                        done(null, true);
                        return;
                    }

                    moveFile(doc, done);
                });
            };


        if (guestId && guestId !== req.user.id) {
            res.clearCookie('guestId', {
                httpOnly: true,
                signed: true,
                path: '/api/v1.0/connection'
            });

            winston.info('Migrating guest %s to %s.', guestId, req.user.id);
            mongoose.models.User.findById(guestId, function(err, rec) {
                if (err) {
                    callback(err);
                    return;
                }

                if (!rec) {
                    callback(null, false);
                    return;
                }

                async.parallel([
                    function(cb) {
                        mongoose.models.Signature.update({
                            user: guestId
                        }, {
                            user: req.user.id
                        }, {
                            multi: true
                        }, cb);
                    },
                    function(cb) {
                        mongoose.models.Folder.update({
                            user: guestId
                        }, {
                            user: req.user.id
                        }, {
                            multi: true
                        }, cb);
                    },
                    findNextDocument
                ], function(err) {
                    if (err) {
                        winston.error('Failed to migrate guest %s to %s', guestId, req.user.id);
                        winston.error(err);
                        callback(err);
                        return;
                    }

                    callback(null, true);
                });
            });
        } else {
            callback(null, false);
        }
    }
};
