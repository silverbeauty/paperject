'use strict';

var winston = require('winston'),
    emailTemplates = require('email-templates'),
    mongoose = require('mongoose'),
    nodemailer = require('nodemailer'),
    sprintf = require('sprintf'), // jshint ignore:line
    atob = require('atob'), // jshint ignore:line
    config = require('./config')(),
    storage = require('./common/server/storage')(config),
    _ = require('lodash'), // jshint ignore:line
    path = require('path'),
    mq = require('./common/server/mq'),
    lzString = require('lz-string'),
    notifyAboutNewTask = function() {
        mq.send('task', {});
    },
    errorHandler = function(res, callback) {
        return function(err) {
            if (err) {
                // more info here
                winston.error(err + '');

                return res.status(400).json({
                    message: err + ''
                });
            }

            var args = [];

            for (var i = 1; i < arguments.length; i++) {
                args.push(arguments[i]);
            }

            return callback.apply(null, args);
        };
    },
    getHostPrefix = function(req) {
        return req.hostname.toLowerCase()
            .replace('localhost', '')
            .replace(/^www\./g, '')
            .replace(/^dev\./g, '')
            .replace(/\.paperjet\.com$/g, '').replace(/paperjet\.com$/g, '')
            .replace(/\./g, '-');
    },
    sendMail = function(app, templateName, recipient, subject, data, req, done) {
        var templatesDir = path.join(path.dirname(require.main.filename), 'views/mailer'),
            mailerConfig = config.mailer,
            branding = getHostPrefix(req),
            fromEmail;

        if (templateName === "signature_request") {
            fromEmail = req.user.email;
        } else {
            fromEmail = _.get(config, 'branding.' + (branding || 'default') + '.email.from') || mailerConfig.from;
        }

        if (!done) {
            done = function() {};
        }

        //validate config
        if (!mailerConfig.service) {
            return done('config.mailer.service must be set');
        }
        if (!mailerConfig.user) {
            return done('config.mailer.service user be set');
        }
        if (!mailerConfig.pass) {
            return done('config.mailer.pass must be set');
        }
        if (!mailerConfig.from) {
            return done('config.mailer.from must be set');
        }

        // prepare email templates for sending
        emailTemplates(templatesDir, function(err, template) {
            if (err) {
                winston.error("Mailer error[emailTemplates]: ", err);
                done(err);
            } else {
                //Prepare nodemailer SMTP(bundled) transport object
                var transport = nodemailer.createTransport({
                    service: mailerConfig.service,
                    auth: {
                        user: mailerConfig.user,
                        pass: mailerConfig.pass
                    }
                });

                var auditData = {
                    template: templateName,
                    from: fromEmail,
                    to: recipient,
                    subject: subject
                };

                if (data) {
                    _.assign(auditData, data);

                    data = _.assign({
                        year: (new Date()).getFullYear(),
                        address: config.companyAddress,
                        appUrl: config.appUrl,
                        branding: branding,
                        buttonStyle: _.get(config, 'branding.' + (branding || 'default') + '.email.buttonStyle') || '',
                        footerHtml: _.get(config, 'branding.' + (branding || 'default') + '.email.footerHtml') || mailerConfig.footerHtml,
                        footerText: _.get(config, 'branding.' + (branding || 'default') + '.email.footerText') || mailerConfig.footerText
                    }, data);
                }

                //compile template
                template(templateName, data, function(err, html, text) {
                    if (err) {
                        winston.error("Mailer error[template]: ", err);
                        done(err);
                    } else {
                        text = text.replace(/<br\/>/gi, '\r\n');

                        transport.sendMail({
                            from: fromEmail,
                            to: recipient,
                            subject: subject,
                            html: html,
                            text: text
                        }, function(err, responseStatus) {
                            if (err) {
                                winston.error("Mailer error[sendMail]: ", err);
                                done(err);
                            } else {
                                app.emit('audit', 'email', {
                                    req: req,
                                    data: auditData
                                });

                                winston.debug('Email "', subject, '" has been sent to ', recipient, 'with message', responseStatus.message);
                                done();
                            }
                        });
                    }
                });
            }
        });
    };

module.exports = {
    getHostPrefix: getHostPrefix,
    errorHandler: errorHandler,
    notifyAboutNewTask: notifyAboutNewTask,

    // uploads PDF layer, and creates a task for the Queue
    createPdfTask: function(req, res, type, taskConfig, callback) {

        var initialConfig = null,
            createTask = function(doc) {
                var json = {
                    type: type,
                    doc: doc.id,
                    priority: 2,
                    status: 'new'
                };

                if (req.user) { // non-registerd users are using forms
                    json.user = req.user.id;
                }

                mongoose.models.Task.create(json, function(err, task) {
                    if (err) {
                        winston.error('Failed to create task to %s %s.', type, doc.id);
                        winston.error(err + '');

                        return res.status(500).json({
                            message: err + ''
                        });
                    }

                    uploadPdfLayer(doc, task);
                });
            },
            uploadPdfLayer = function(doc, task) {
                if (type === 'sendForm') {
                    taskConfig.layerKey = sprintf('%s-f%s-t%s-d%s-%s', config.s3.layerPrefix, req.params.formId, task.id, doc.id, doc.fileName);
                } else {
                    taskConfig.layerKey = sprintf('%s-u%s-t%s-d%s-%s', config.s3.layerPrefix, task.user, task.id, doc.id, doc.fileName);
                    taskConfig.printKey = doc.printKey;
                }

                taskConfig.layerBucket = config.s3.tmpBucket;
                taskConfig.layerRegion = config.s3.tmpRegion;
                taskConfig.documentName = doc.name;
                taskConfig.documentFileName = doc.fileName;
                taskConfig.documentKey = doc.fileKey;
                taskConfig.documentRegion = doc.storageRegion;
                taskConfig.documentBucket = doc.storageBucket;
                taskConfig.branding = getHostPrefix(req);


                var pdfStr = lzString.decompressFromBase64(req.body.pdf);
                storage.putBuffer(taskConfig.layerKey, taskConfig.layerBucket, taskConfig.layerRegion, new Buffer(atob(pdfStr), 'binary'),
                    function(err) {
                        if (err) {
                            winston.error('Failed to upload PDF layer to S3 for task %s, doc %s.', task.id, doc.id);
                            winston.error(err + '');

                            return res.status(500).json({
                                message: err + ''
                            });
                        }

                        var to = '';

                        if (type === 'email') {
                            to = initialConfig.to || '';

                            if (initialConfig.cc) {
                                if (to.length) {
                                    to += ', ';
                                }

                                to += initialConfig.cc;
                            }

                            if (initialConfig.bcc) {
                                if (to.length) {
                                    to += ', ';
                                }

                                to += initialConfig.bcc;
                            }
                        } else if (type === 'fax') {
                            to = initialConfig.number;
                            taskConfig.email = req.user.email;
                        } else if (type === 'sendSignature') {
                            to = initialConfig.send.to;
                        }

                        task.set({
                            status: 'ready',
                            config: taskConfig
                        });

                        task.save(errorHandler(res, function(taskRec) {
                            if (type === 'email' || type === 'fax' || type === 'sendSignature') {
                                mongoose.models.SentItem.create({
                                    type: type,
                                    name: doc.name,
                                    task: taskRec.id,
                                    doc: doc.id,
                                    to: to,
                                    user: req.params.userId,
                                    status: 'pending',
                                    storageBucket: doc.storageBucket,
                                    storageRegion: doc.storageRegion,
                                    config: initialConfig
                                }, errorHandler(res, function(item) {
                                    req.app.emit('sentItem.insert', {
                                        userId: req.params.userId,
                                        id: item.id,
                                        data: item.toJSON()
                                    });

                                    notifyAboutNewTask();

                                    if (type === 'fax') {
                                        mongoose.models.User.findById(req.user.id, errorHandler(res, function(user) {
                                            if (user.metrics.freeFaxPages > 0) {
                                                user.metrics.freeFaxPages = user.metrics.freeFaxPages - taskConfig.pageCount;
                                            }

                                            user.metrics.faxPages = user.metrics.faxPages - taskConfig.pageCount;

                                            user.save(errorHandler(res, function(rec) {
                                                callback(doc);
                                                res.json({
                                                    users: [rec]
                                                });
                                            }));
                                        }));
                                    } else {
                                        callback(doc);
                                        res.sendStatus(200);
                                    }
                                }));
                            } else {
                                notifyAboutNewTask();
                                callback(doc);
                                res.sendStatus(200);
                            }
                        }));
                    }, true);
            };

        if (type === 'email' || type === 'fax' || type === 'sendSignature') {
            initialConfig = _.assign({}, taskConfig);
        }

        mongoose.models.Document.findById(req.params.id, errorHandler(res, createTask));
    },

    sendMail: sendMail,

    sendSystemMessage: function(app, req, title, message) {
        winston.info('System Message:', title, message.replace(/<br\/>/gi, '\r\n'));
        sendMail(app, 'system_message', config.mailer.supportEmail, title, {
            title: title,
            message: message
        }, req);
    }
};
