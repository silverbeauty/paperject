var mongoose = require('mongoose'),
    winston = require('winston'),
    async = require('async'),
    config = require('../config')(),
    storage = require('../common/server/storage')(config),
    _ = require('lodash'), // jshint ignore:line
    utils = require('../utils'),
    clonePreviews = function(origDoc, doc, callback) {
        var tasks = [],
            createClonePreviewTask = function(i) {
                return function(cb) {
                    storage.getBuffer(origDoc.previewKey + i + '.png', origDoc.storageBucket, origDoc.storageRegion, function(err, buffer) {
                        if (err) {
                            cb(err);
                            return;
                        }

                        storage.putBuffer(doc.previewKey + i + '.png', doc.storageBucket, doc.storageRegion, buffer, cb, true);
                    });
                };
            };

        for (var i = 0; i < doc.pageCount; i++) {
            tasks.push(createClonePreviewTask(i));
        }

        async.parallelLimit(tasks, 5, callback);
    },
    cloneDoc = function(originalDoc, originalPages, buffer, newUserId, callback) {
        var json = originalDoc.toJSON();
        json.isViewed = false;
        json.user = newUserId;
        delete json._id;
        delete json.createdAt;
        delete json.updatedAt;

        mongoose.models.Document.create(json, function(err, rec) {
            if (err) {
                winston.error('Failed to create doc.');
                winston.error(err);
                callback(err);
                return;
            }

            rec.setStorageKey(config.s3.instancePrefix);

            rec.save(function(err, doc) {
                if (err) {
                    winston.error('Failed to update doc.');
                    winston.error(err);
                    doc.removeDocumentWithData(function() {
                        callback(err);
                    });
                    return;
                }

                storage.putBuffer(doc.fileKey, doc.storageBucket, doc.storageRegion, buffer, function(err) {
                    if (err) {
                        doc.removeDocumentWithData(function() {
                            callback(err);
                        });
                        return;
                    }

                    var newPages = new Array(originalPages.length);

                    for (var i = 0; i < originalPages.length; i++) {
                        newPages[i] = originalPages[i];
                        delete newPages[i]._id;
                        delete newPages[i].createdAt;
                        delete newPages[i].updatedAt;
                        newPages[i].doc = doc._id;
                    }

                    mongoose.models.Page.create(newPages, function(err) {
                        if (err) {
                            doc.removeDocumentWithData(function() {
                                callback(err);
                            });
                            return;
                        }

                        clonePreviews(originalDoc, doc, function(err) {
                            if (err) {
                                doc.removeDocumentWithData(function() {
                                    callback(err);
                                });
                                return;
                            }

                            callback(null, doc);
                        });
                    });
                }, true);
            });
        });
    },
    cloneWithData = function(doc, pages, newUserId, callback) {
        storage.getBuffer(doc.fileKey, doc.storageBucket, doc.storageRegion, function(err, buffer) {
            if (err) {
                callback(err);
                return;
            }

            cloneDoc(doc, pages, buffer, newUserId, callback);
        });
    },
    cloneWithPageData = function(id, pages, newUserId, callback) {
        mongoose.models.Document.findById(id, function(err, doc) {
            if (err) {
                callback(err);
                return;
            }

            cloneWithData(doc, pages, newUserId, callback);
        });
    };

module.exports = {
    cloneWithPageData: cloneWithPageData,
    clone: function(id, userId, newUserId, callback) {
        mongoose.models.Document.findById(id, function(err, doc) {
            if (err) {
                callback(err);
                return;
            }

            if (!doc) {
                callback('Document ' + id + ' not found');
                return;
            }

            if ((doc.user + '') !== userId) {
                callback('Access denied');
                return;
            }
            mongoose.models.Page.find({
                doc: id
            }, function(err, pages) {
                if (err) {
                    callback(err);
                    return;
                }

                var arr = new Array(pages.length);

                for (var i = 0; i < pages.length; i++) {
                    arr[i] = pages[i].toJSON();
                }

                cloneWithData(doc, arr, newUserId, callback);
            });
        });
    }
};
