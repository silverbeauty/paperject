var session = require('../middleware/session'),
    mongoose = require('mongoose'),
    passport = require('passport'),
    utils = require('../utils'),
    _ = require('lodash'), // jshint ignore:line
    config = require('../config')(),
    createForm = function(req, res) {
        mongoose.models.Document.findById(req.params.id, utils.errorHandler(res, function(rec) {
            if (!rec) {
                return res.sendStatus(404);
            }

            if ((rec.user + '') !== req.user.id) {
                return res.sendStatus(403);
            }

            if (!req.body.form) {
                req.body.form = {};
            }

            req.body.form.user = req.user.id;
            req.body.form.doc = req.params.id;

            if (req.user.branding) {
                var brand = req.user.branding;

                if (brand.cssClass) {
                    req.body.form.cssClass = brand.cssClass;
                }

                if (brand.homepage) {
                    req.body.form.homepage = brand.homepage;
                }

                if (brand.homepageTitle) {
                    req.body.form.homepageTitle = brand.homepageTitle;
                }
            }

            if (!req.body.form.fallbackEmail) {
                req.body.form.fallbackEmail = req.user.email;
            }

            mongoose.models.Form.create(req.body.form, utils.errorHandler(res, function(rec) {
                res.json(rec);
            }));
        }));
    };

module.exports = function(app) {
    app.get('/api/v1.0/documents/:id/forms/:formId/status', passport.authenticate('basic', {
        session: false
    }), function(req, res) {
        if (config.env === 'production' && !req.secure && req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
        }

        mongoose.models.Form.findById(req.params.formId, utils.errorHandler(res, function(rec) {
            if (!rec || (rec.doc + '') !== req.params.id) {
                return res.sendStatus(404);
            }

            if ((rec.user + '') !== req.user.id) {
                return res.sendStatus(403);
            }

            res.json({
                form: rec.toJSON()
            });
        }));
    });

    app.get('/api/v1.0/documents/:id/forms/:formId', function(req, res) {
        var operations = 2,
            form,
            pages,
            doc,
            mergeObjects = function(pageObjects, formPageObjects) {
                _.each(formPageObjects, function(formObj) {
                    if (formObj && formObj.text) {
                        _.each(pageObjects, function(pageObj) {
                            if (pageObj.id == formObj.id) { // compare as str
                                pageObj.text = formObj.text;
                                return false;
                            }
                        });
                    }
                });
            },
            sendResult = function() {
                if (--operations === 0) {
                    if (form.pages) {
                        for (var i = 0; i < form.pages.length; i++) {
                            for (var j = 0; j < pages.length; j++) {
                                if (pages[j].i === i + 1) {
                                    mergeObjects(pages[j].objects, form.pages[i].objects);
                                    break;
                                }
                            }
                        }
                    }

                    res.json({
                        documents: [doc.getPublicData()],
                        pages: pages,
                        forms: [form]
                    });
                }
            },
            getPages = function() {
                mongoose.models.Page.find({
                    doc: req.params.id
                }, utils.errorHandler(res, function(records) {
                    pages = records;
                    sendResult();
                }));
            },
            getDoc = function() {
                mongoose.models.Document.findById(req.params.id, utils.errorHandler(res, function(rec) {
                    if (!rec) {
                        return res.sendStatus(404);
                    }

                    doc = rec;
                    sendResult();
                }));
            };

        mongoose.models.Form.findOne({
            _id: req.params.formId,
            status: 'new'
        }, utils.errorHandler(res, function(rec) {
            if (!rec || (rec.doc + '') !== req.params.id) {
                return res.sendStatus(404);
            }

            form = rec;
            getDoc();
            getPages();
        }));
    });

    app.post('/api/v1.0/documents/:id/forms/:formId', function(req, res) {
        if (req.body.action === 'sendForm') {
            mongoose.models.Form.findOne({
                _id: req.params.formId,
                status: 'new'
            }, utils.errorHandler(res, function(form) {
                if (!form || (form.doc + '') !== req.params.id) {
                    return res.sendStatus(404);
                }

                var config = {
                        formId: req.params.formId,
                        to: req.body.to,
                        cc: req.body.cc,
                        subject: req.body.subject,
                        message: req.body.message
                    },
                    auditData = {};

                _.assign(auditData, config);

                utils.createPdfTask(req, res, 'sendForm', config, function(doc) {
                    if (!form.multi) {
                        form.status = 'complete';
                        form.save();
                    }

                    mongoose.models.User.updateMetricsOnFormSend(req, app, form.user);

                    app.emit('audit', 'form.email', {
                        req: req,
                        id: req.params.formId,
                        data: {
                            user: form.user,
                            email: form.email,
                            doc: doc.getAuditData()
                        }
                    });
                });

                return;
            }));

            return;
        }

        res.status(400).json({
            message: 'Unknown action ' + req.body.action
        });
    });

    app.post('/api/v1.0/documents/:id/forms', passport.authenticate('basic', {
        session: false
    }), function(req, res) {
        if (config.env === 'production' && !req.secure && req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
        }

        createForm(req, res);
    });

    app.post('/api/v1.0/users/:userId/documents/:id/forms', session.isAuthenticated, function(req, res) {
        createForm(req, res);
    });
};
