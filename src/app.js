'use strict';

var config = require('./config')(),
    useCluster = config.env === 'production',
    winston = require('winston'),
    fs = require('fs'),
    _ = require('lodash'), // jshint ignore:line
    sprintf = require('sprintf'), // jshint ignore:line
    mongoose = require('mongoose'),
    utils = require('./utils'),
    server,
    isNotMobileDevice = function(userAgent) {
        return !(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()));
    },
    initLogger = function(app) {
        var monitoringLogger = new winston.Logger('MMM'),
            path = require('path');

        app.set('monitoringLogger', monitoringLogger);
        monitoringLogger.add(winston.transports.Console, {
            level: config.logging.level,
            colorize: true,
            timestamp: true,
            label: 'monitoring'
        });

        monitoringLogger.add(winston.transports.File, {
            filename: path.join(__dirname, 'logs/monitoring.log'),
            level: config.monitoring.logLevel,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 10
        });

        winston.remove(winston.transports.Console);
        winston.add(winston.transports.Console, {
            handleExceptions: true,
            level: config.logging.level,
            colorize: true,
            timestamp: true
        });

        winston.add(winston.transports.File, {
            handleExceptions: true,
            filename: path.join(__dirname, 'logs/app.log'),
            level: config.logging.level,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 10
        });

        if (config.enablePapertrail) {
            var Papertrail = require('winston-papertrail').Papertrail;

            winston.add(Papertrail, {
                handleExceptions: true,
                host: config.papertrail.host,
                port: config.papertrail.port,
                hostname: config.papertrail.hostname,
                level: config.papertrail.level,
                colorize: true,
                logFormat: function(level, message) {
                    return '(' + process.pid + ') ' + level + ' ' + message;
                }
            });

            monitoringLogger.add(Papertrail, {
                host: config.papertrail.host,
                port: config.papertrail.port,
                hostname: config.papertrail.hostname + '/monitoring',
                level: config.papertrail.level,
                colorize: true,
                logFormat: function(level, message) {
                    return '(' + process.pid + ') ' + level + ' ' + message;
                }
            });
        }

        if (config.logging.emailRecipients && config.mailer.smtpHost && config.mailer.user && config.mailer.pass) {
            require('winston-mail');

            winston.add(winston.transports.Mail, {
                handleExceptions: true,
                to: config.logging.emailRecipients,
                from: config.logging.emailFrom,
                host: config.mailer.smtpHost,
                port: config.mailer.smtpPort,
                username: config.mailer.user,
                password: config.mailer.pass,
                level: config.logging.emailLevel
            });

            winston.info('Will send error logs to', config.logging.emailRecipients);
        }
    },
    initExpress = function() {
        var express = require('express'),
            path = require('path'),
            app = express(),
            md5 = require('MD5'),
            http = require('http'),
            https = require('https'),
            session = require('./middleware/session'),
            passport = session.init(app),
            bodyParser = require('body-parser'),
            cookieSession = require('cookie-session')({
                keys: config.auth.sessionCookieKey2 ? [config.auth.sessionCookieKey1, config.auth.sessionCookieKey2] : [config.auth.sessionCookieKey1],
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            }),
            pdfjsVersion = (function() {
                // this is to emulate 'rev' grunt plugin, and use unique URLs for dirrerent version of PDFjs, to keep browser's caches happy
                if (config.env !== 'production') {
                    return '';
                }

                try {
                    var str = fs.readFileSync(path.join(__dirname, 'client', 'bower_components', 'pdfjs-dist', 'bower.json'), 'utf8'),
                        json = JSON.parse(str);

                    return json.version;
                } catch (e) {
                    winston.error('Failed to get PDFJS version: ' + e);
                    return '';
                }
            })(),
            removeTmpFile = function(file) {
                winston.silly('Removing tmp %s', file.path);
                fs.unlink(file.path, function(err) {
                    winston.silly('Removed tmp %s: %s', file.path, err || 'OK');
                });
            },
            askToRegister = function(req) {
                //if user is logged in anonymously, then trigger event to ask for signup in 1 minute
                if ((typeof req.user != 'undefined') && (req.user.isAnonymous === true)) {
                    setTimeout(function() {
                        app.emit('ask-to-register', req.user._id);
                    }, 60000 * 1);
                }
            },
            setBrandCssClass = function(req, res) {
                var hostPrefix = utils.getHostPrefix(req);

                if (hostPrefix) {
                    res.locals.brandCssClass = hostPrefix + ' branded';
                    res.locals.brandFavicon = _.get(config, 'branding.' + hostPrefix + '.favicon');

                    if (config.webPagesNotAvailable[hostPrefix]) {
                        res.locals.brandCssClass += ' hide-site-links';
                    }
                } else {
                    res.locals.brandCssClass = '';
                }
            },
            render404 = function(req, res) {
                res.locals.userId = req.user ? req.user._id : '';
                res.locals.userAvatar = req.user ? md5(req.user.email) : '';
                setBrandCssClass(req, res);
                res.render('web/general/404.jade');
            };

        app.setBrandCssClass = setBrandCssClass;

        initLogger(app);

        if (config.env === 'production') {
            app.set('views', path.join(__dirname, 'dist', 'views'));
        } else {
            app.set('views', path.join(__dirname, 'views'));
        }

        session.initPrivateMode(app);

        app.locals.googleAnalyticsTrackingID = config.google.analyticsTrackingID; // for jade
        app.locals.googleClientID = config.google.clientID; // for jade
        app.locals.stripePublicKey = config.stripe.publicKey; // for jade
        app.locals.pricing = config.pricing;
        app.locals.pdfjsVersion = pdfjsVersion;
        app.locals.devMode = config.env !== 'production';
        app.locals.freeUploadsQuota = config.freeUploadsQuota;
        app.locals.paperjetBrandHost = config.paperjetBrandHost;

        if (config.enableNewRelic) {
            app.locals.newrelic = require('newrelic'); // for jade
        } else {
            app.locals.newrelic = {
                getBrowserTimingHeader: function() {
                    return '';
                }
            };
        }
        app.set('view engine', 'jade');
        app.use(require('serve-favicon')(path.join(__dirname, 'client', 'favicon.ico')));
        app.use(require('compression')());
        app.use(bodyParser.json({
            limit: '50mb'
        }));
        app.use(bodyParser.urlencoded({
            extended: true,
            limit: '50mb'
        }));

        app.set('UPLOAD_FILE_SIZE_LIMIT', 100 * 1024 * 1024);

        app.use(require('multer')({
            limits: {
                fileSize: app.get('UPLOAD_FILE_SIZE_LIMIT')
            }
        }));

        app.use(require('method-override')());
        app.use(require('cookie-parser')(config.auth.cookieSecret));
        app.use(require('helmet')());

        if (config.env === 'production') {
            app.use('/', express['static'](path.join(__dirname, '/dist'), {
                maxAge: 31557600000 // one year
            }));

            // route for PDF.js
            app.use('/scripts/pdfjs' + pdfjsVersion + '/build', express['static'](path.join(__dirname, 'client/bower_components/pdfjs-dist/build'), {
                maxAge: 31557600000 // one year
            }));

            app.use('/scripts/pdfjs' + pdfjsVersion + '/web', express['static'](path.join(__dirname, 'client/bower_components/pdfjs-dist/web'), {
                maxAge: 31557600000 // one year
            }));

            app.use('/scripts/pdfjs' + pdfjsVersion + '/cmaps', express['static'](path.join(__dirname, 'client/bower_components/pdfjs-dist/cmaps'), {
                maxAge: 31557600000 // one year
            }));
        } else {
            app.use('/scripts', express['static'](path.join(__dirname, '/.tmp/scripts'), {
                maxAge: 0
            }));

            app.use('/scripts/pdfjs', express['static'](path.join(__dirname, 'client/bower_components/pdfjs-dist'), {
                maxAge: 0
            }));

            app.use('/styles', express['static'](path.join(__dirname, '/.tmp/styles'), {
                maxAge: 0
            }));

            // route for LESS sourcemaps
            app.use('/client/bower_components', express['static'](path.join(__dirname, '/client/bower_components'), {
                maxAge: 0
            }));

            app.use('/bower_components/ember/ember.js', express['static'](path.join(__dirname, '/client/bower_components/ember/ember.debug.js'), {
                maxAge: 0
            }));

            // route for LESS sourcemaps
            app.use('/client/styles', express['static'](path.join(__dirname, '/client/styles'), {
                maxAge: 0
            }));

            app.use('/', express['static'](path.join(__dirname, '/client'), {
                maxAge: 0
            }));

            winston.info('Adding latency to simulate real-life connection...');
            app.use(function(req, res, next) {
                setTimeout(next, 50);
            });
        }

        app.use(cookieSession); // keep sessions small, so no need to persist info in DB

        app.use(passport.initialize());
        app.use(passport.session());

        app.use(function(req, res, next) {
            winston.silly('+ %s %s', req.method, req.url);
            var start = Date.now();

            res.on('close', function() {
                _.forOwn(req.files, removeTmpFile);
                winston.silly('- %s %s: %s', req.method, req.url, Date.now() - start);
            });

            res.on('finish', function() {
                _.forOwn(req.files, removeTmpFile);
                winston.silly('- %s %s: %s', req.method, req.url, Date.now() - start);
            });

            next();
        });

        if (config.redirectToWww) {
            app.get('*', function(req, res, next) {
                if (req.headers.host === 'paperjet.com') {
                    res.redirect(req.protocol + '://www.' + req.headers.host + req.url, 301);
                } else {
                    next();
                }
            });
        }

        session.initOAuthRoutes(app);
        // app.use(app.router);

        require('./routes')(app);
        require('./common/server/models')();
        require('./services/audit')(app);
        require('./monitoring')(app);

        app.get('/', function(req, res) {
            if (config.webPagesNotAvailable[utils.getHostPrefix(req)]) {
                res.redirect('https://' + req.hostname + '/dashboard');
                return;
            }

            res.locals.userId = req.user ? req.user._id : '';
            res.locals.userAvatar = req.user ? md5(req.user.email) : '';
            res.render('web/index.jade');
        });

        app.get('/dashboard*', function(req, res) {
            if (req.url === '/dashboard') {
                res.redirect('/dashboard/');
                return;
            }
            askToRegister(req);
            setBrandCssClass(req, res);
            res.render('dashboard.jade');
        });

        app.get('/admin*', function(req, res) {
            if (config.adminPagesNotAvailable[utils.getHostPrefix(req)]) {
                render404(req, res);
                return;
            }

            if (!req.user || !req.user.get('isAdmin')) {
                render404(req, res);
                return;
            }

            if (req.url === '/admin') {
                res.redirect('/admin/');
                return;
            }

            res.render('admin.jade');
        });

        app.get('/document*', function(req, res) {
            if (req.url === '/document') {
                res.redirect('/document/');
                return;
            }

            res.locals.hideOlark = !isNotMobileDevice(req.headers['user-agent'] || '');

            askToRegister(req);
            setBrandCssClass(req, res);
            res.render('document.jade');
        });

        app.get('/allangray-forms', function(req, res) {
            var hostPrefix = utils.getHostPrefix(req);

            if (hostPrefix !== 'allangray') {
                render404();
                return;
            }

            setBrandCssClass(req, res);
            res.locals.userId = req.user ? req.user._id : '';
            res.locals.userAvatar = req.user ? md5(req.user.email) : '';

            res.render('web/general/allangray-forms.jade');
        });

        app.use(function(req, res, next) {
            render404(req, res);
        });

        server = require('http').createServer(app);
        require('./socket')(app, server, cookieSession);
    },
    initMongoose = function() {
        var connectionString = config.db.connectionString;

        if (config.env !== 'production') {
            mongoose.set('debug', function(collectionName, method, query, doc, opt) {
                winston.silly('%s %s %s %s $s', collectionName, method, JSON.stringify(query).substr(0, 512), JSON.stringify(doc).substr(0, 512), opt);
            });
        }

        mongoose.connect(connectionString, {
            db: {
                safe: true
            }
        }, function(err, res) {
            if (err) {
                winston.error('ERROR connecting to %s: %s.', connectionString, err);
            } else {
                winston.info('Successfully connected to %s.', connectionString);
            }
        });
    };

initExpress();
initMongoose();

server.listen(config.server.port, function() {
    winston.info('Express started HTTP on port ' + config.server.port + ', environment: ' + config.env + ', process: ' + process.pid);
});
