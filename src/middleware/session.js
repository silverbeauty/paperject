'use strict';

var mongoose = require('mongoose'),
    sprintf = require('sprintf'), // jshint ignore:line
    winston = require('winston'),
    utils = require('../utils');

exports.init = function(app) {
    var passport = require('passport'),
        config = require('../config')(),
        LocalStrategy = require('passport-local').Strategy,
        GoogleStrategy = require('passport-google-oauth').OAuth2Strategy,
        FacebookStrategy = require('passport-facebook').Strategy,
        BasicStrategy = require('passport-http').BasicStrategy,
        findUserOrCreate = function(accessToken, refreshToken, profile, done) {
            mongoose.models.User.findOne({
                email: profile.emails[0].value.toLowerCase()
            }, function(err, user) {
                if (err) {
                    return done(err);
                }

                if (user) {
                    if (profile.provider === 'google') {
                        if (user.googleProfileId) {
                            if (user.googleProfileId !== profile.id) {
                                return done('We have found user with email ' + profile.emails[0].value + ', but Google ID does not match.');
                            }
                        } else {
                            user.googleProfileId = profile.id;
                        }
                    } else if (profile.provider === 'facebook') {
                        if (user.fbProfileId) {
                            if (user.fbProfileId !== profile.id) {
                                return done('We have found user with email ' + profile.emails[0].value + ', but Facebook ID does not match.');
                            }
                        } else {
                            user.fbProfileId = profile.id;
                        }
                    }

                    if (user.isModified()) {
                        user.save(function(err, rec) {
                            if (err) {
                                return done(err);
                            }

                            app.emit('audit', 'provider.user.create', {
                                id: rec._id,
                                email: profile.emails[0].value.toLowerCase(),
                                authType: profile.provider === 'google' ? 'Google' : 'FB'
                            });

                            app.emit('audit', 'provider.user.login', rec);
                            return done(null, rec);
                        });

                        return;
                    } else {
                        app.emit('audit', 'provider.user.login', user);
                        return done(null, user);
                    }
                }

                var json = {
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName,
                    email: profile.emails[0].value.toLowerCase(),
                    password: '',
                    isEmailConfirmed: true,
                    isActive: true,
                    tips: {
                        // confirmEmail: new Date(), // no need to confirm email
                        freeFaxPages: new Date()
                    }
                };

                if (profile.provider === 'google') {
                    json.googleProfileId = profile.id;
                } else if (profile.provider === 'facebook') {
                    json.fbProfileId = profile.id;
                }

                mongoose.models.User.create(json, function(err, rec) {
                    if (err) {
                        return done(err);
                    }

                    app.emit('audit', 'provider.user.create', {
                        id: rec._id,
                        email: profile.emails[0].value.toLowerCase(),
                        authType: profile.provider === 'google' ? 'Google' : 'FB'
                    });

                    app.emit('audit', 'provider.user.login', rec);

                    utils.sendMail(app, 'welcome', profile.emails[0].value, 'Welcome to Paperjet', {}, {
                        hostname: '',
                        user: rec
                    }, function(err) {
                        return done(err, rec);
                    });
                });
            });
        };

    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        mongoose.models.User.findById(id, function(err, user) {
            if (err) {
                return done(err);
            }

            if (!user) {
                return done(null, false);
            }

            user.checkSubscription(app, {
                user: user
            }, true, function(rec) {
                done(null, rec);
            }, function(err) {
                done(err);
            });
        });
    });

    passport.use(new BasicStrategy(
        function(username, password, done) {
            mongoose.models.User.findOne({
                email: username.toLowerCase()
            }, function(err, user) {
                if (err) {
                    return done(err);
                }

                if (!user) {
                    return done(null, false);
                }

                user.verifyPassword(password, function(err, matched) {
                    if (err || !matched) {
                        return done(err, matched);
                    }

                    return done(null, user);
                });
            });
        }
    ));

    passport.use(new LocalStrategy(
        function(username, password, done) {
            mongoose.models.User.findOne({
                email: username.toLowerCase() // TODO: fields
            }, function(err, user) {
                if (err) {
                    return done(err);
                }

                if (!user) {
                    return done(null, false);
                }

                if ((!!user.googleProfileId || !!user.fbProfileId) && !user.password) {
                    return done('You have signed up with Google/Facebook. If you want to login with password, you should set it.', false);
                } else {
                    user.verifyPassword(password, function(err, matched) {
                        if (err || !matched) {
                            return done(err, matched);
                        }
                        return done(null, user);
                    });
                }
            });
        }
    ));

    passport.use(new GoogleStrategy({
        clientID: config.google.clientID,
        clientSecret: config.google.clientSecret,
        callbackURL: config.appUrl + '/auth/google.return' // use . in the name to prevent URL rewriting by connect-history-api-fallback
    }, findUserOrCreate));

    passport.use(new FacebookStrategy({
        clientID: config.facebook.clientID,
        clientSecret: config.facebook.clientSecret,
        callbackURL: config.appUrl + '/auth/facebook.return'
    }, findUserOrCreate));

    return passport;
};

exports.isAuthenticated = function(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    } else {
        res.sendStatus(401);
    }
};

exports.initOAuthRoutes = function(app) {
    var passport = require('passport');

    function socialLoginCallback(req, res) {
        var redirect = '/dashboard';

        if (req.session.redirect === 'landing') {
            delete req.session.redirect;
            redirect = '/';
        }

        if (!!req.session.inviteId && !req.user.inviter) {
            mongoose.models.User.updateInviterAndInvitee(app, req, req.session.inviteId, req.user._id, function() {
                mongoose.models.User.findOne({
                    inviteId: req.session.inviteId
                }, function(err, inviter) {
                    if (err) {
                        return winston.error('An error occured while sending email to invitor' + err);
                    }
                    if (!inviter) {
                        return winston.error('Inviter not found');
                    }
                    utils.sendMail(app, 'uploads_received', inviter.email, 'Your uploads limit was increased', inviter, req, utils.errorHandler(res, function() {
                        // utils.errorHandler requires callback
                    }));
                });

                delete req.session.inviteId;
                // NOTE: don't show error and redirect to the dashboard even if inviteId processing has been failed
                res.redirect(redirect);
            });
        } else {
            res.redirect(redirect);
        }
    }

    app.get('/auth/google.login', // use . in the name to prevent URL rewriting by connect-history-api-fallback
        function(req, res, next) {
            req.session.inviteId = req.query.inviteId;
            req.session.redirect = req.query.redirect;
            next();
        },
        passport.authenticate('google', {
            scope: ['profile', 'email']
        })
    );

    app.get('/auth/google.return',
        passport.authenticate('google', {
            failureRedirect: '/dashboard'
        }), socialLoginCallback);

    app.get('/auth/facebook.login', // use . in the name to prevent URL rewriting by connect-history-api-fallback
        function(req, res, next) {
            req.session.inviteId = req.query.inviteId;
            req.session.redirect = req.query.redirect;
            next();
        },
        passport.authenticate('facebook', {
            scope: ['email']
        })
    );

    app.get('/auth/facebook.return',
        passport.authenticate('facebook', {
            failureRedirect: '/dashboard'
        }), socialLoginCallback);
};

exports.initPrivateMode = function(app) {
    var config = require('../config')();

    if (config.privateMode) {
        var basicAuth = require('basic-auth'),
            passwordCache = {};

        app.on('dbupdate', function(req, model) {
            if (model === 'user') {
                passwordCache = {};
            }
        });

        app.use(function(req, res, next) {
            if (req.url.toLowerCase() === config.monitoring.path.toLowerCase()) {
                return next();
            }

            var authUser = basicAuth(req),
                unauthorized = function() {
                    if (authUser && authUser.name && authUser.pass) {
                        winston.warn('Unauthorized', authUser.name, req.headers['x-forwarded-for'] || req.connection.remoteAddress);
                    }

                    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
                    return res.sendStatus(401);
                };

            if (!authUser || !authUser.name || !authUser.pass) {
                return unauthorized();
            }

            if (passwordCache[authUser.name] === authUser.pass) {
                return next();
            }

            mongoose.models.User.findOne({
                email: authUser.name.toLowerCase()
            }, function(err, rec) {
                if (err) {
                    winston.error(err);
                    return unauthorized();
                }

                if (!rec) {
                    return unauthorized();
                }

                if ((!!rec.googleProfileId || !!rec.fbProfileId) && !rec.password) {
                    return unauthorized();
                } else {
                    rec.verifyPassword(authUser.pass, function(err, matched) {
                        if (err || !matched) {
                            return unauthorized();
                        }

                        passwordCache[authUser.name] = authUser.pass;
                        return next();
                    });
                }
            });
        });
    }
};

exports.checkOwnerParam = function(req, res, next) {
    if (req.user.id !== req.params.userId) {
        return res.sendStatus(404); // can query only own objects
    }

    next();
};
