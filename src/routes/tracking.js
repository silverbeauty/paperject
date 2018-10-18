'use strict';

var session = require('../middleware/session'),
    mongoose = require('mongoose'),
    utils = require('../utils');

module.exports = function(app) {
    // no userId in uri since anonymous user doesn't have it
    app.post('/api/v1.0/tracking', function(req, res) {
        mongoose.models.Audit.create({
            user: (req.user && req.user._id) ? req.user._id : undefined,
            type: 'frontend.jserror',
            operation: 'insert',
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            data: req.body
        }, utils.errorHandler(res, function() {
            res.sendStatus(201);
        }));
    });
};
