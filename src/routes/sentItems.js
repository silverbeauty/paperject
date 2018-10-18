'use strict';

/*global unescape*/

var session = require('../middleware/session'),
    mongoose = require('mongoose'),
    utils = require('../utils'),
    config = require('../config')(),
    winston = require('winston'),
    storage = require('../common/server/storage')(config);

module.exports = function(app) {
    app.get('/api/v1.0/users/:userId/sentItems/:id', session.isAuthenticated, session.checkOwnerParam, function(req, res) {
        mongoose.models.SentItem.findOne({
            _id: req.params.id,
            user: req.user.id
        }, utils.errorHandler(res, function(rec) {
            if (rec) {
                res.json({
                    sentItems: [rec]
                });
            } else {
                res.sendStatus(404);
            }
        }));
    });

    app['delete']('/api/v1.0/users/:userId/sentItems/:id', session.isAuthenticated, session.checkOwnerParam, function(req, res) {
        mongoose.models.SentItem.findOne({
            _id: req.params.id,
            user: req.user.id
        }, utils.errorHandler(res, function(rec) {
            if (!rec) {
                res.sendStatus(404);
                return;
            }

            var removeRec = function() {
                rec.remove(utils.errorHandler(res, function() {
                    app.emit('dbupdate', req, 'sentItem', 'delete', req.params.id, null);
                    res.sendStatus(204);
                }));
            };

            if (rec.storageKey && rec.storageBucket && rec.storageRegion) {
                storage.deleteKey(rec.storageKey, rec.storageBucket, rec.storageRegion, removeRec);
            } else {
                removeRec();
            }
        }));
    });
};
