'use strict';

var session = require('../middleware/session'),
    mongoose = require('mongoose'),
    winston = require('winston'),
    utils = require('../utils'),
    sendSignature = function(res, req, app, operation) {
        return function(rec) {
            if (!rec) {
                return res.sendStatus(404);
            }

            if (req && app && operation) {
                app.emit('dbupdate', req, 'signature', operation, rec._id, null);
            }

            res.json({
                signature: rec.toJSON()
            });
        };
    };

module.exports = function(app) {
    app.get('/api/v1.0/users/:userId/signatures/:id', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own signatures
        }

        mongoose.models.Signature.findOne({
            _id: req.params.id,
            user: req.user.id
        }, utils.errorHandler(res, sendSignature(res)));
    });

    app.get('/api/v1.0/users/:userId/signatures', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own signatures
        }

        var sendResult = function(records) {
            for (var i = 0; i < records.length; i++) {
                records[i] = records[i].toJSON();
            }

            res.json({
                signatures: records
            });
        };

        var options = {
            user: req.params.userId
        };

        if (req.query.ids) {
            options._id = {
                $in: req.query.ids
            };
        }

        mongoose.models.Signature.find(options, null, {
            sort: {
                name: 1
            }
        }, utils.errorHandler(res, sendResult));
    });

    app.post('/api/v1.0/users/:userId/signatures', function(req, res) {
        var registeredUser = true,
            userId;

        if (req.isAuthenticated()) {
            if (req.user.id !== req.params.userId) {
                return res.sendStatus(404); // can query only own signatures
            }

            userId = req.user.id;
        } else if (req.params.userId && req.params.userId.indexOf('non-registered-user') === 0) {
            registeredUser = false;
            userId = req.params.userId.substr('non-registered-user-'.length);

            if (req.body.action !== 'captureSignatureForForm') {
                return req.sendStatus(400);
            }
        } else {
            res.sendStatus(401);
        }

        if (req.body.action === 'captureSignature' || req.body.action === 'captureSignatureForForm') {
            mongoose.models.Task.create({
                type: 'captureSignature',
                user: userId,
                priority: 3,
                doc: null,
                config: {
                    forForm: req.body.action === 'captureSignatureForForm',
                    registeredUser: registeredUser,
                    imgSrc: req.body.imgSrc,
                    type: req.body.type,
                    noCrop: req.body.noCrop,
                    name: req.body.name
                },
                status: 'ready'
            }, function(err, task) {
                if (err) {
                    winston.error('Failed to create task to capture signature for user %s.', req.params.userId);
                    winston.error(err + '');

                    return res.status(500).json({
                        message: err + ''
                    });
                }

                return res.json({
                    taskId: task._id + ''
                });
            });
        } else {
            if (registeredUser) {
                req.body.signature.user = req.params.userId;
                mongoose.models.Signature.create(req.body.signature, utils.errorHandler(res, sendSignature(res, req, app, 'insert')));
            } else {
                res.status(400).json({
                    message: 'User is not registered'
                });
            }
        }
    });

    // app.put('/api/v1.0/users/:userId/signatures/:id', session.isAuthenticated, function(req, res) {
    //     if (req.user.id !== req.params.userId) {
    //         return res.sendStatus(404); // can query only own signatures
    //     }
    //
    //     var updateSignature = function(rec) {
    //         if (!rec || (rec.user + '') !== req.user.id) {
    //             return res.sendStatus(404);
    //         }
    //
    //         if (rec.updatedAt.getTime() !== Date.parse(req.body.signature.updatedAt)) {
    //             return res.sendStatus(409);
    //         }
    //
    //         rec.set(req.body.signature);
    //         rec.save(utils.errorHandler(res, sendSignature(res, req, app, 'update')));
    //     };
    //
    //     mongoose.models.Signature.findById(req.params.id, utils.errorHandler(res, updateSignature));
    // });

    app['delete']('/api/v1.0/users/:userId/signatures/:id', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own signatures
        }

        mongoose.models.Signature.findById(req.params.id, 'user', utils.errorHandler(res, function(rec) {
            if (!rec || (rec.user + '') !== req.user.id) {
                return res.sendStatus(404);
            }

            rec.remove(function(err) {
                if (err) {
                    return res.status(500).json({
                        message: err + ''
                    });
                }

                app.emit('dbupdate', req, 'signature', 'delete', req.params.id, null);
                res.sendStatus(204);
            });
        }));
    });
};
