'use strict';

var session = require('../middleware/session'),
    mongoose = require('mongoose'),
    _ = require('lodash'), // jshint ignore:line
    config = require('../config.js')(),
    utils = require('../utils');

module.exports = function(app) {
    app.post('/api/v1.0/support', function(req, res) {
        var auditData = _.assign({}, req.body);

        utils.sendMail(app, 'support_request', config.mailer.supportEmail, 'Support request: ' + req.body.subject, req.body, req,
            utils.errorHandler(res, function() {
                var json = {
                    type: 'support',
                    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                    data: auditData
                };

                if (req.user && req.user.id) {
                    json.user = req.user.id;
                }

                mongoose.models.Audit.create(json, utils.errorHandler(res, function() {
                    res.sendStatus(201);
                }));
            }));
    });
};
