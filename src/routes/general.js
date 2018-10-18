'use strict';

var config = require('../config')(),
    md5 = require('MD5'),
    utils = require('../utils'),
    sprintf = require('sprintf'); // jshint ignore:line

module.exports = function(app) {
    var pages = ['security', 'support', 'affiliates',
        'privacy', 'terms', 'about', 'faq', 'fill-in-forms',
        'sign-forms', 'fax', 'mobile-app', 'blog', 'pricing'
    ];

    pages.forEach(function(page) {
        app.get('/' + page, function(req, res) {
            var hostPrefix = utils.getHostPrefix(req);

            app.setBrandCssClass(req, res);
            res.locals.userId = req.user ? req.user._id : '';
            res.locals.userAvatar = req.user ? md5(req.user.email) : '';

            if (config.webPagesNotAvailable[hostPrefix]) {
                res.render('web/general/404.jade');
                return;
            }

            res.render('web/general/' + page + '.jade');
        });
    });
};
