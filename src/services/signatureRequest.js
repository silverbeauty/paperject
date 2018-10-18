var session = require('../middleware/session'),
    mongoose = require('mongoose'),
    config = require('../config')(),
    async = require('async'),
    storage = require('../common/server/storage')(config),
    winston = require('winston'),
    passport = require('passport'),
    cloneDoc = require('./cloneDoc'),
    _ = require('lodash'), // jshint ignore:line
    utils = require('../utils');

module.exports = {
    send: function(app, docId, user, req, res) {
        mongoose.models.Document.findById(docId, utils.errorHandler(res, function(doc) {
            if (!doc) {
                return res.sendStatus(404);
            }

            mongoose.models.User.findById(doc.user, utils.errorHandler(res, function(user) {
                if (!user) {
                    return res.sendStatus(404);
                }

                var taskConfig = {
                        send: {
                            from: doc.signatureRequest.to,
                            to: user.email
                        }
                    },
                    auditData = {};

                utils.createPdfTask(req, res, 'sendSignature', taskConfig, function() {});
            }));
        }));
    },

    request: function(app, docId, user, requestConfig, inboxFolderId, req, res) {
        if (!requestConfig.to || !requestConfig.to.trim()) {
            return res.status(400).json({
                message: 'Email is required'
            });
        }

        var sendEmail = function(email, callback) {
                cloneDoc.cloneWithPageData(docId, requestConfig.pages, user.id, function(err, doc) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    doc.folders = [inboxFolderId];
                    doc.isViewed = false;
                    doc.signatureRequest = {
                        to: email,
                        acknowledged: false
                    };

                    doc.save(function(err, doc) {
                        if (err) {
                            doc.removeDocumentWithData(function() {
                                callback(err);
                            });

                            return;
                        }

                        var userName = (user.firstName + ' ' + user.lastName).trim(),
                            buttonStyle = _.get(config, 'branding.' + (utils.getHostPrefix(req) || 'default') + '.email.buttonStyle') || '';

                        utils.sendMail(app, 'signature_request', email, requestConfig.subject, {
                            id: doc._id,
                            docName: doc.name,
                            appUrl: requestConfig.appUrl,
                            userName: userName || user.email,
                            message: requestConfig.message,
                            branding: utils.getHostPrefix(req),
                            buttonStyle: buttonStyle
                        }, req, function(err) {
                            if (err) {
                                doc.removeDocumentWithData(function() {
                                    callback(err);
                                });

                                return;
                            }

                            mongoose.models.SentItem.create({
                                type: 'signatureRequest',
                                status: 'sent',
                                name: doc.name,
                                doc: docId,
                                config: {
                                    requestDoc: doc.id
                                },
                                to: email,
                                user: user.id,
                                storageBucket: doc.storageBucket,
                                storageRegion: doc.storageRegion
                            }, function(err, sentItem) {
                                // ignore errors
                                if (sentItem) {
                                    req.app.emit('sentItem.insert', {
                                        userId: req.params.userId,
                                        id: sentItem.id,
                                        data: sentItem.toJSON()
                                    });
                                }

                                app.emit('audit', 'document.insert', {
                                    req: req,
                                    data: doc.getAuditData()
                                });

                                mongoose.models.User.findOne({
                                    email: email
                                }, function(err, user) {
                                    if (user) {
                                        app.emit('dbupdate', {
                                            headers: {},
                                            user: user
                                        }, 'document', 'insert', doc.id, doc.getPublicData());
                                    }
                                });

                                callback();
                            });
                        });
                    });
                });
            },
            emails = requestConfig.to.toLowerCase().split(','),
            tasks = [];

        for (var i = 0; i < emails.length; i++) {
            if (emails[i].trim().length) {
                tasks.push(_.bind(sendEmail, null, emails[i].trim()));
            }
        }

        async.series(tasks, function(err) {
            if (err) {
                return res.status(400).json({
                    message: err + ''
                });
            }

            res.sendStatus(204);
        });
    }
};
