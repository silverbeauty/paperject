'use strict';

var mongoose = require('mongoose'),
    utils = require('../utils');

module.exports = function(app) {

    app.post('/subscriptions/mobile-apps', function(req, res) {
        mongoose.models.Subscription.create(req.body, utils.errorHandler(res, function() {
            res.sendStatus(204);
        }));
    });
};
