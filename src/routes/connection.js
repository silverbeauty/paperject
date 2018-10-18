'use strict';

var passport = require('passport'),
    session = require('../middleware/session'),
    mongoose = require('mongoose'),
    md5 = require('MD5'),
    utils = require('../utils'),
    guestMigration = require('../services/guestMigration'),
    winston = require('winston'),
    config = require('../config')(),
    uuid = require('node-uuid'),
    _ = require('lodash'), // jshint ignore:line
    CONFIRM_EMAIL_TITLE = 'Please confirm your email',
    registerLocalUserAndSendConfirmEmail = function(email, password, app, req, res) {
        if (!_.isString(email) || email.length === 0 || !_.isString(password) || password.length === 0) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        email = email.toLowerCase();

        var confirmationHash = md5(email + Math.random().toString()),
            newUser = new mongoose.models.User({
                email: email,
                password: password,
                confirmationHash: confirmationHash,
                isEmailConfirmed: false,
                isAnonymous: false,
                tips: {
                    confirmEmail: new Date(),
                    freeFaxPages: new Date()
                }
            }),

            saveUserAndSendEmail = function(user) {
                user.save(utils.errorHandler(res, function(user) {
                    // inviteId will be used in confirm-email route
                    req.session.inviteId = req.body.inviteId;

                    var emailData = {
                        confirmationHash: user.confirmationHash,
                        user: user
                    };

                    utils.sendMail(app, 'email_confirmation', user.email, CONFIRM_EMAIL_TITLE, emailData, req, utils.errorHandler(res, function() {
                        req.login(user, utils.errorHandler(res, function() {
                            app.emit('dbupdate', req, 'user', 'insert', user.id, {
                                email: user.email
                            });

                            app.emit('audit', 'user.login', req);
                            res.json(user);
                        }));
                    }));
                }));
            };

        mongoose.models.User.findOne({
            email: email
        }, utils.errorHandler(res, function(user) {
            if (user) {
                res.status(400).json({
                    code: 'duplicated_email'
                });
            } else {
                if (req.user && req.user.isAnonymous) {
                    // update existing anounym to save current document etc.
                    mongoose.models.User.findById(req.user.id, utils.errorHandler(res, function(foundUser) {
                        req.logout();

                        if (foundUser) {
                            foundUser.email = email;
                            foundUser.password = password;
                            foundUser.confirmationHash = confirmationHash;
                            foundUser.isEmailConfirmed = false;
                            foundUser.isAnonymous = false;

                            saveUserAndSendEmail(foundUser);
                        } else {
                            // anonym user was not found - create a new user
                            saveUserAndSendEmail(newUser);
                        }
                    }));
                } else {
                    // no anounymous user was previously created - create a new user
                    saveUserAndSendEmail(newUser);
                }
            }
        }));
    },

    registerSignatureRequestAccount = function(app, req, res) {
        if (!_.isString(req.body.doc) || req.body.doc.length === 0) {
            return res.status(400).json({
                message: 'Doc ID is required'
            });
        }

        mongoose.models.Document.findById(req.body.doc, function(err, doc) {
            if (err || !doc || !doc.signatureRequest) {
                return res.sendStatus(401);
            }

            mongoose.models.User.findOne({
                email: doc.signatureRequest.to
            }, function(err, user) {
                if (user) {
                    return res.status(400).json({
                        message: 'User exists. Please reload the page'
                    });
                }

                registerLocalUserAndSendConfirmEmail(doc.signatureRequest.to, uuid.v4(), app, req, res);
            });
        });
    },

    sendPasswordResetLink = function(app, req, res) {
        // apply md5 to uuid since it will be shorter
        var passResetHash = md5(uuid.v4()),
            query = {
                email: req.body.email
            },
            update = {
                passResetHash: passResetHash
            },
            options = {
                'new': true,
                upsert: false
            };

        mongoose.models.User.findOneAndUpdate(query, update, options, utils.errorHandler(res, function(user) {
            if (user) {
                var emailData = {
                    user: user
                };
                utils.sendMail(app, 'password_reset_link', user.email, 'Password reset link', emailData, req, utils.errorHandler(res, function() {
                    res.sendStatus(200);
                }));
            } else {
                res.status(400).json({
                    message: 'There is no user with such email'
                });
            }
        }));
    },

    resetPassword = function(req, res) {
        if (!req.body.passResetHash) {
            return res.status(404).json({
                message: 'You password reset link is incorrect.'
            });
        }

        if (!_.isString(req.body.password) || req.body.password.length === 0) {
            return res.status(400).json({
                message: 'Password is required'
            });
        }

        var query = {
            passResetHash: req.body.passResetHash
        };
        mongoose.models.User.findOne(query, utils.errorHandler(res, function(user) {
            if (user) {
                user.password = req.body.password;
                user.passResetHash = '';
                user.save(utils.errorHandler(res, function() {
                    res.sendStatus(200);
                }));
            } else {
                res.status(400).json({
                    message: 'User not found. You password reset link seems to be incorrect.'
                });
            }
        }));
    },

    changePassword = function(req, res) {
        if (!_.isString(req.body.newPassword) || req.body.newPassword.length === 0) {
            return res.status(400).json({
                message: 'Password is required'
            });
        }

        var query = {
            _id: req.user.id
        };

        // check if old password is correct
        mongoose.models.User.findOne(query, utils.errorHandler(res, function(user) {
            if (!user) {
                return res.status(400).json({
                    message: 'User not found'
                });
            }

            var updatePassword = function(newPassword, confirmNewPassword) {
                if (newPassword === confirmNewPassword) {
                    user.password = newPassword;
                    user.save(utils.errorHandler(res, function() {
                        res.sendStatus(200);
                    }));
                } else {
                    res.status(400).json({
                        message: 'Please confirm new password'
                    });
                }
            };

            if (!user.isPassworSet) {
                updatePassword(req.body.newPassword, req.body.confirmNewPassword);
            } else {
                user.verifyPassword(req.body.oldPassword, function(err, matched) {
                    if (err || !matched) {
                        res.status(400).json({
                            message: 'Old password is incorrect'
                        });
                    } else {
                        // old password is correct, update it with the new one
                        updatePassword(req.body.newPassword, req.body.confirmNewPassword);
                    }
                });
            }
        }));
    },
    registerGuestUser = function(app, req, res) {
        var anonym = new mongoose.models.User({
                email: 'anonymous_' + md5(uuid.v4()) + '@paperjet.com',
                password: '',
                isAnonymous: true
            }),
            sendResponse = utils.errorHandler(res, function(user) {
                res.json(user);
            });

        // create anonym user and login him
        anonym.save(function(err, user) {
            if (!err) {
                req.login(user, function(loginErr) {
                    app.emit('dbupdate', req, 'user', 'insert', user.id, {
                        email: user.email,
                        isAnonymous: true
                    });

                    app.emit('audit', 'user.login', req);

                    res.cookie('guestId', user.id, {
                        httpOnly: true,
                        signed: true,
                        path: '/api/v1.0/connection'
                    });

                    sendResponse(loginErr, user);
                });
            } else {
                sendResponse(err);
            }
        });
    },
    sendConfirmationEmail = function(app, req, res) {
        var sendEmail = function(user) {
            utils.sendMail(app, 'email_confirmation', user.email, CONFIRM_EMAIL_TITLE, {
                confirmationHash: user.confirmationHash,
                user: user
            }, req, utils.errorHandler(res, function() {
                res.sendStatus(200);
            }));
        };

        mongoose.models.User.findById(req.user.id, utils.errorHandler(res, function(user) {
            if (user.confirmationHash) {
                sendEmail(user);
            } else {
                user.confirmationHash = mongoose.Types.ObjectId();
                user.save(utils.errorHandler(res, function(user) {
                    sendEmail(user);
                }));
            }
        }));
    };

module.exports = function(app) {
    app.get('/api/v1.0/connection', function(req, res) {
        if (!req.isAuthenticated()) {
            if (req.query.doc) {
                mongoose.models.Document.findById(req.query.doc, function(err, doc) {
                    if (err || !doc || !doc.signatureRequest) {
                        return res.sendStatus(401);
                    }

                    mongoose.models.User.findOne({
                        email: doc.signatureRequest.to
                    }, function(err, user) {
                        return res.status(401).json({
                            signatureRequest: {
                                docName: doc.name,
                                recipientEmail: doc.signatureRequest.to,
                                recipientExists: !err && !!user
                            }
                        });
                    });
                });
            } else {
                return res.sendStatus(401);
            }

            return;
        }

        guestMigration.migrateData(app, req, res, utils.errorHandler(res, function(migrated) {
            var user = req.user.toJSON(),
                branding = utils.getHostPrefix(req);

            user.supportsUpload = !config.uploadNotAvailable[branding];
            user.supportsManageFolders = !config.manageFoldersNotAvailable[branding];

            res.json({
                migrated: migrated,
                user: user
            });
        }));
    });

    app.get('/confirm-email/:hash', function(req, res) {
        var query = {
            '$and': [{
                confirmationHash: req.param('hash')
            }, {
                confirmationHash: {
                    $ne: ''
                }
            }]
        };
        var update = {
            isEmailConfirmed: true,
            confirmationHash: ''
        };
        var options = {
            'new': true,
            upsert: false
        };
        mongoose.models.User.findOneAndUpdate(query, update, options, utils.errorHandler(res, function(user) {
            if (user) {
                if (!!req.session.inviteId && !user.inviter) {
                    mongoose.models.User.updateInviterAndInvitee(app, req, req.session.inviteId, user._id, function(err) {
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
                        if (err) {
                            // just log error, it's not critical for entire system
                            winston.error('An error occured while handling inviteId' + err);
                        }
                    });
                }

                // confirmation link is correct, login user and redirect him to the dashboard
                req.login(user, utils.errorHandler(res, function() {
                    app.emit('audit', 'user.login', req);
                    utils.sendMail(app, 'welcome', user.email, 'Welcome to Paperjet', {}, req, utils.errorHandler(res, function() {
                        res.redirect('/dashboard/documents');
                    }));
                }));
            } else {
                // show 404 page - confirmation link is incorrect
                res.sendStatus(404);
            }
        }));
    });


    /**
     * Route for login and register actions
     *
     * The 'action' field must  be set to either 'login' or 'register' in the POST body.
     */
    app.post('/api/v1.0/connection', function(req, res) {
        var action = req.body.action;
        if (action === 'login') {
            var authenticateUser = function(authDone) {
                passport.authenticate('local', utils.errorHandler(res, function(user) {
                    if (user && user.isActive) {
                        req.login(user, utils.errorHandler(res, function() {
                            app.emit('audit', 'user.login', req);
                            authDone(null, user);
                        }));
                    } else {
                        var message = '';
                        if (!user) {
                            message = 'Invalid username or password';
                        } else if (!user.isActive) {
                            message = 'Your account has been cancelled';
                        }
                        authDone(message);
                    }
                }))(req, res, utils.errorHandler(res, function() {
                    // utils.errorHandler requires callback
                }));
            };

            authenticateUser(function(err, user) {
                if (err) {
                    res.json(config.privateMode ? 400 : 401, {
                        message: err
                    });
                    return;
                }

                guestMigration.migrateData(app, req, res, utils.errorHandler(res, function(migrated) {
                    res.json({
                        migrated: migrated,
                        user: user
                    });
                }));
            });
        } else if (action === 'register') {
            registerLocalUserAndSendConfirmEmail(req.body.email, req.body.password, app, req, res);
        } else if (action === 'register-signature-request-account') {
            registerSignatureRequestAccount(app, req, res);
        }
        // If users came from landing page by pressing 'Try Paperjet', then create anonymous profile and login
        // as anonymous user
        else if (action === 'register-anonymous') {
            registerGuestUser(app, req, res);
        } else if (action === 'send-reset-password-link') {
            sendPasswordResetLink(app, req, res);
        } else if (action === 'reset-password') {
            resetPassword(req, res);
        } else if (action === 'change-password') {
            changePassword(req, res);
        } else if (action === 'send-confirmation-email') {
            sendConfirmationEmail(app, req, res);
        } else {
            winston.error('Invalid action ' + action);

            res.status(400).json({
                message: 'Invalid action'
            });
        }
    });

    app['delete']('/api/v1.0/connection', function(req, res) {
        app.emit('audit', 'user.logout', req);
        req.logout();
        res.sendStatus(204);
    });

    app.post('/api/v1.0/producthunt', function(req, res) {
        mongoose.models.User.findById(req.user.id, utils.errorHandler(res, function(user) {
            if (user.subscription['package'] !== 'pro') {
                user.metrics.freeFaxPages = 100;
                user.metrics.faxPages = Math.max(100, user.metrics.faxPages);
                user.subscription['package'] = 'pro';
                user.subscription.type = 'annual';
                user.subscription.paidUntil = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000);

                user.save(utils.errorHandler(res, function(user) {
                    app.emit('dbupdate', req, 'user', 'update', req.user.id, user);

                    res.json({
                        user: user
                    });
                }));
            } else {
                res.sendStatus(400);
            }
        }));
    });
};
