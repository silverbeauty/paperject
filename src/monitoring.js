'use strict';

var config = require('./config')(),
    sprintf = require('sprintf'), // jshint ignore:line
    _ = require('lodash'), // jshint ignore:line
    btoa = require('btoa'), // jshint ignore:line
    path = require('path'),
    tmp = require('tmp'),
    fs = require('fs'),
    winston = require('winston'),
    request = require('request').defaults({
        pool: {
            maxSockets: Infinity
        },
        headers: {
            Authorization: config.privateMode ? ('Basic ' + btoa(config.monitoring.user + ':' + config.monitoring.pass)) : ''
        }
    }),
    operation = 0,
    checkErrorResponse = function(res, err, httpResponse, body, operation, context) {
        if (err) {
            if (httpResponse) {
                httpResponse.resume();
            }

            context.error('Monitoring failure in %s. ', operation, err);
            context.error(err);
            res.send(err + '');
            return true;
        }

        if (httpResponse.statusCode !== 200 && httpResponse.statusCode !== 204) {
            httpResponse.resume();
            context.error('Monitoring failure in %s. HTTP %s. %s', operation, httpResponse.statusCode, body);
            res.send(body);
            return true;
        }

        return false;
    },
    logout = function(req, res, context) {
        context.enterFunction('logout');
        request.del({
            url: sprintf('%s/api/v1.0/connection', config.monitoring.host),
            jar: context.jar
        }, function(err, httpResponse, body) {
            if (checkErrorResponse(res, err, httpResponse, body, 'logout', context)) {
                return;
            }

            context.exitFunction('logout');
            context.log('Monitoring OK: %sms.', Date.now() - context.start);
            res.send('OK');
        });
    },
    removePdf = function(req, res, context) {
        context.enterFunction('removePdf');
        request.del({
            url: sprintf('%s/api/v1.0/users/%s/documents/%s', config.monitoring.host, context.userId, context.documentId),
            jar: context.jar
        }, function(err, httpResponse, body) {
            if (checkErrorResponse(res, err, httpResponse, body, 'removePdf', context)) {
                return;
            }

            context.exitFunction('removePdf');
            logout(req, res, context);
        });
    },
    downloadAndVerifyPdf = function(req, res, context) {
        context.enterFunction('downloadPdf %s', context.documentId);

        tmp.dir({
            unsafeCleanup: true
        }, function(err, tmpPath, cleanupCallback) {
            if (err) {
                context.error('Monitoring failure. Failed to create tmp dir:' + err);
                return res.send(err + '');
            }

            var fileName = path.join(tmpPath, 'test.pdf');

            request.get({
                url: 'http:' + context.documentUrl,
                jar: context.jar
            }, function(err, httpResponse, body) {
                setTimeout(function() {
                    context.exitFunction('downloadPdf %s', context.documentId);
                    context.enterFunction('verifyPdf');

                    if (checkErrorResponse(res, err, httpResponse, body, 'download', context)) {
                        cleanupCallback();
                        return;
                    }

                    fs.readFile(path.join(__dirname, '/monitoring-test.pdf'), function(err, originalData) {
                        if (err) {
                            cleanupCallback();
                            context.error('Monitoring failure. Failed to read original file: ', err);
                            return res.send(err + '');
                        }

                        fs.readFile(fileName, function(err, testData) {
                            if (err) {
                                cleanupCallback();
                                context.error('Monitoring failure. Failed to read test file: ', err);
                                return res.send(err + '');
                            }

                            if (originalData.length !== testData.length) {
                                // cleanupCallback();
                                context.error(sprintf('Monitoring failure. File size don\'t match. Expected %s bytes, got %s bytes. File name: %s', originalData.length, testData.length, fileName));
                                return res.send('File size don\'t match');
                            }

                            for (var i = 0; i < originalData.length; ++i) {
                                if (originalData[i] !== testData[i]) {
                                    cleanupCallback();
                                    context.error('Monitoring failure. File content don\'t match.');
                                    return res.send('File content don\'t match');
                                }
                            }

                            cleanupCallback();
                            context.exitFunction('verifyPdf');

                            setTimeout(function() {
                                removePdf(req, res, context);
                            }, 1000);
                        });
                    });
                }, 100);
            }).pipe(fs.createWriteStream(fileName));
        });
    },
    uploadPdf = function(req, res, context) {
        context.enterFunction('uploadPdf');

        var r = request.post({
            url: sprintf('%s/api/v1.0/users/%s/documents', config.monitoring.host, context.userId),
            json: true,
            jar: context.jar
        }, function(err, httpResponse, body) {
            if (checkErrorResponse(res, err, httpResponse, body, 'upload', context)) {
                return;
            }

            context.exitFunction('uploadPdf');
            context.documentId = body.document._id;
            context.documentUrl = body.document.fileUrl;
            downloadAndVerifyPdf(req, res, context);
        });

        var form = r.form();
        form.append('action', 'uploadFile');
        form.append('doNotScan', 'true');
        form.append('doc', fs.createReadStream(path.join(__dirname, '/monitoring-test.pdf')), {
            filename: 'monitoring-test.pdf'
        });
    },
    checkLogin = function(req, res, context) {
        context.enterFunction('checkLogin');
        request.get({
            url: sprintf('%s/api/v1.0/connection', config.monitoring.host),
            jar: context.jar,
            json: true
        }, function(err, httpResponse, body) {
            if (checkErrorResponse(res, err, httpResponse, body, 'checkLogin', context)) {
                return;
            }

            context.exitFunction('checkLogin');
            uploadPdf(req, res, context);
        });
    },
    login = function(req, res, context) {
        context.enterFunction('login');
        request.post({
            url: sprintf('%s/api/v1.0/connection', config.monitoring.host),
            jar: context.jar,
            json: {
                action: 'login',
                username: config.monitoring.user,
                password: config.monitoring.pass
            }
        }, function(err, httpResponse, body) {
            if (checkErrorResponse(res, err, httpResponse, body, 'login', context)) {
                return;
            }

            context.exitFunction('login');
            context.userId = body.user._id;
            checkLogin(req, res, context);
        });
    },
    loadPage = function(req, res, context) {
        context.enterFunction('loadPage');
        request.get({
            url: sprintf('%s/dashboard', config.monitoring.host)
        }, function(err, httpResponse, body) {
            if (checkErrorResponse(res, err, httpResponse, body, 'loadPage', context)) {
                return;
            }

            if (body.indexOf('dashboard.app.js') === -1) {
                context.error('Monitoring failure. Failed to load dashboard.');
                return res.send('Failed to load dashboard.');
            }

            context.exitFunction('loadPage');
            login(req, res, context);
        });
    },
    getArgsArray = function(args) {
        var result = [];

        for (var i = 0; i < args.length; ++i) {
            result.push(args[i]);
        }

        return result;
    };

module.exports = function(app) {
    app.get('/' + config.monitoring.path, function(req, res) {
        var logger = app.get('monitoringLogger'),
            context = {
                jar: request.jar(),
                start: Date.now(),
                methodStart: 0,
                operation: ++operation,
                enterFunction: function() {
                    context.methodStart = Date.now();
                    var args = getArgsArray(arguments);
                    args[0] = '#' + context.operation + ' +' + arguments[0];
                    logger.debug.apply(logger.debug, args);
                },
                exitFunction: function() {
                    var args = getArgsArray(arguments);
                    args[0] = '#' + context.operation + ' -' + arguments[0] + ': %sms';
                    args.push(Date.now() - context.methodStart);
                    logger.debug.apply(logger.debug, args);
                },
                log: function() {
                    var args = getArgsArray(arguments);
                    args[0] = '#' + context.operation + ' ' + arguments[0];
                    logger.debug.apply(logger.debug, args);
                },
                error: function() {
                    var args = getArgsArray(arguments);
                    args[0] = '#' + context.operation + ' ' + arguments[0];
                    logger.error.apply(logger.debug, args);
                }
            };

        context.enterFunction('Monitoring');
        loadPage(req, res, context);
    });
};
