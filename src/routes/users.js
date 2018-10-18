'use strict';

var session = require('../middleware/session'),
    mongoose = require('mongoose'),
    winston = require('winston'),
    sprintf = require('sprintf'), // jshint ignore:line
    config = require('../config.js')(),
    utils = require('../utils'),
    strings = require('../strings'),
    moment = require('moment'),
    async = require('async'),
    _ = require('lodash'), // jshint ignore:line
    stripe = require('stripe')(config.stripe.secretKey),
    checkSubscription = function(app, req, res) {
        req.user.checkSubscription(app, req, false, function() {
            res.sendStatus(204);
        }, function() {
            res.sendStatus(500);
        });
    };

module.exports = function(app) {
    // app.get('/api/v1.0/users', session.isAuthenticated, function(req, res) {
    //     var sendResult = function(records) {
    //         res.json({
    //             users: records
    //         });
    //     };

    //     mongoose.models.User.find({}, {
    //         password: false,
    //         authToken: false
    //     }, utils.errorHandler(res, sendResult));
    // });

    app.get('/api/v1.0/users/:id', session.isAuthenticated, function(req, res) {
        var sendResult = function(rec) {
            if (!rec) {
                return res.sendStatus(404);
            }

            res.json({
                user: rec
            });
        };

        mongoose.models.User.findById(req.params.id, {
            password: false,
            fbProfileId: false,
            googleProfileId: false
        }, utils.errorHandler(res, sendResult));
    });

    app.get('/api/v1.0/users/:id/outbox', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.id) {
            return res.sendStatus(404);
        }

        if (req.user.isAnonymous) {
            app.emit('ask-to-register', req.user._id);
            return res.status(403).json({
                message: 'Anonymous users are not allowed to print, download and send documents'
            });
        }

        if (!req.user.isEmailConfirmed) {
            return res.status(403).json({
                message: strings.CONFIRM_EMAIL_MESSAGE
            });
        }
        // to do

    });

    // app.post('/api/v1.0/users', session.isAuthenticated, function(req, res) {
    //     console.log('POST /api/v1.0/users');
    //     var sendResult = function(rec) {
    //         rec.password = null;
    //         rec.authToken = null;
    //
    //         res.json({
    //             user: rec
    //         });
    //     };
    //
    //     mongoose.models.User.create(req.body.user, utils.errorHandler(res, sendResult));
    // });

    app.put('/api/v1.0/users/:id', session.isAuthenticated, function(req, res) {
        var updateDoc = function(rec) {
            if (!rec) {
                return res.sendStatus(404);
            }


            var allowedFields = ['firstName', 'lastName', 'email', 'tips'],
                sendResult = function(rec) {
                    rec.password = null;
                    rec.fbProfileId = null;
                    rec.googleProfileId = null;

                    app.emit('dbupdate', req, 'user', 'update', req.user.id, rec);

                    res.json({
                        user: rec
                    });
                };

            //update white-listed fields only
            allowedFields.forEach(function(field) {
                rec[field] = req.body.user[field];
            });
            rec.save(utils.errorHandler(res, sendResult));
        };

        mongoose.models.User.findById(req.params.id, utils.errorHandler(res, updateDoc));
    });

    app.post('/api/v1.0/users/:id/payment', session.isAuthenticated, function(req, res) {
        if (req.body.type !== 'fax') {
            return res.status(400).json({
                message: 'Unknown payment type.'
            });
        }

        var makePayment = function(user) {
            if (!user) {
                return res.sendStatus(404);
            }

            stripe.charges.create({
                amount: req.body.amount, // amount in cents, again
                currency: 'usd',
                card: req.body.token,
                description: 'Paperjet Fax refill for ' + user.email
            }, function(err, charge) {
                if (err) {
                    winston.error(err);

                    if (err.type === 'StripeCardError') { // The card has been declined
                        return res.status(400).json({
                            message: err.message
                        });
                    }

                    return res.sendStatus(400);
                }

                var pages = req.body.amount === 500 ? 20 : 50,
                    serviceName = 'Paperjet Fax refill (%s pages)';

                app.emit('audit', 'payment.fax', {
                    req: req,
                    data: charge
                });

                user.metrics.faxPages = user.metrics.faxPages + pages;

                utils.sendMail(app, 'payment', user.email, sprintf('$%s Paid', req.body.amount / 100), {
                    amount: req.body.amount / 100,
                    name: user.displayName || user.email,
                    type: 'Charge',
                    id: charge.id,
                    date: moment().format('LL'),
                    service: sprintf(serviceName, pages)
                }, req);

                user.save(utils.errorHandler(res, function(user) {
                    res.json({
                        user: user
                    });
                }));
            });
        };

        mongoose.models.User.findById(req.params.id, utils.errorHandler(res, makePayment));
    });

    app.post('/api/v1.0/users/:id/subscription', session.isAuthenticated, function(req, res) {
        var createSubscription = function(user) {
                stripe.customers.createSubscription(user.subscription.customerId, {
                    plan: config.stripe.plans[req.body.subscription]
                }, function(err, subscription) {
                    if (err) {
                        winston.error('createSubscription', user._id + '', user.subscription.customerId, req.body.subscription);
                        winston.error(err);
                        return res.sendStatus(400);
                    }

                    app.emit('audit', 'payment.subscription.create', {
                        req: req,
                        data: subscription
                    });

                    var ONE_DAY = 24 * 60 * 60 * 1000; // Add one day to the paid period, to ensure that payment has some time to proceed

                    user.billedAt = new Date();
                    if (req.body.subscriptionPackage === 'pro') {
                        user.metrics.storageLimit = 5 * 1024 * 1024 * 1024;
                    }
                    // else if (req.body.subscriptionPackage === 'business') {
                    //     user.metrics.storageLimit = 10 * 1024 * 1024 * 1024;
                    // }

                    if (!user.subscription) {
                        user.subscription = {};
                    }

                    if (user.subscription.paidUntil && user.subscription.type === req.body.subscription) {
                        // If user subscribed, then cancelled, account is still paid until end date.
                        // If user decides to subscribe again, we add date difference if package (Pro/Business/Whatever) is the same.
                        user.subscription.paymentPeriodDiffMs = Math.max(user.subscription.paidUntil.getTime() - subscription.current_period_start - ONE_DAY, 0);
                    } else {
                        user.subscription.paymentPeriodDiffMs = 0;
                    }

                    // Add one day to the paid period, to ensure that payment has some time to proceed
                    user.subscription.paidUntil = new Date(subscription.current_period_end * 1000 + user.subscription.paymentPeriodDiffMs + ONE_DAY);
                    user.subscription.type = req.body.subscription;
                    user.subscription['package'] = req.body.subscriptionPackage;
                    user.subscription.subscriptionId = subscription.id;
                    user.subscription.autoCheckSubscription = true;

                    // TODO: what if users registers, then deregisters, then registers
                    user.metrics.freeFaxPages = 100;
                    user.metrics.faxPages = Math.max(100, user.metrics.faxPages);

                    var amount = config.pricing[req.body.subscriptionPackage][req.body.subscription],
                        packageName = req.body.subscriptionPackage === 'pro' ? 'Pro' : 'Business',
                        paymentPeriodName = req.body.subscription === 'monthly' ? 'Month' : 'Year',
                        service = sprintf('Paperjet %s ($%s/%s)', packageName, amount, paymentPeriodName);

                    utils.sendMail(app, 'payment', user.email, sprintf('$%s Paid', amount), {
                        amount: amount,
                        name: user.displayName || user.email,
                        type: 'Subscription',
                        id: subscription.id,
                        date: moment().format('LL'),
                        service: service
                    }, req);

                    user.save(utils.errorHandler(res, function() {
                        res.json({
                            user: user
                        });
                    }));
                });
            },
            updateCustomer = function(user) {
                stripe.customers.update(user.subscription.customerId, {
                    card: req.body.token
                }, function(err, customer) {
                    if (err) {
                        winston.error('customers.update', user._id + '', user.subscription.customerId, req.body.token);
                        winston.error(err);
                        return res.sendStatus(400);
                    }

                    app.emit('audit', 'payment.customer.update', {
                        req: req,
                        data: customer
                    });

                    user.save(utils.errorHandler(res, function(user) {
                        createSubscription(user);
                    }));
                });
            },
            createCustomer = function(user) {
                var description = sprintf('Paperjet PRO subscription for %s.', user.email, req.body.subscription);

                stripe.customers.create({
                    card: req.body.token,
                    description: description
                }, function(err, customer) {
                    if (err) {
                        winston.error('customers.create', user._id + '', req.body.token, description);
                        winston.error(err);
                        return res.sendStatus(400);
                    }

                    if (!user.subscription) {
                        user.subscription = {};
                    }

                    user.subscription.provider = 'stripe';
                    user.subscription.customerId = customer.id;

                    app.emit('audit', 'payment.customer.create', {
                        req: req,
                        data: customer
                    });

                    user.save(utils.errorHandler(res, function(user) {
                        createSubscription(user);
                    }));
                });
            },
            userLoaded = function(user) {
                if (!user) {
                    return res.sendStatus(404);
                }

                if (user.subscription && user.subscription.customerId) {
                    updateCustomer(user);
                } else {
                    createCustomer(user);
                }
            };

        if (req.body.action === 'checkSubscription') {
            checkSubscription(app, req, res);
            return;
        }

        if (req.body.subscription !== 'annual' && req.body.subscription !== 'monthly') {
            return res.status(400).json({
                message: 'Subscription type is not supported.'
            });
        }

        if (req.body.subscriptionPackage !== 'pro' && req.body.subscriptionPackage !== 'business') {
            return res.status(400).json({
                message: 'Subscription package is not supported.'
            });
        }

        if (req.user.id !== req.params.id) {
            return res.sendStatus(404);
        }

        mongoose.models.User.findById(req.params.id, utils.errorHandler(res, userLoaded));
    });

    app['delete']('/api/v1.0/users/:id/subscription', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.id) {
            return res.sendStatus(404);
        }

        var userLoaded = function(user) {
            if (!user) {
                return res.sendStatus(404);
            }

            if (!user.subscription || !user.subscription.customerId || !user.subscription.subscriptionId) {
                return res.status(400).json({
                    message: 'Subscription not found'
                });
            }

            stripe.customers.cancelSubscription(user.subscription.customerId, user.subscription.subscriptionId, function(err, confirmation) {
                if (err) {
                    winston.error('cancelSubscription', user._id + '', user.subscription.customerId, user.subscription.subscriptionId);
                    winston.error(err);
                    return res.sendStatus(400);
                }

                app.emit('audit', 'payment.subscription.cancel', {
                    req: req,
                    id: user.subscription.subscriptionId,
                    data: confirmation
                });

                user.subscription.subscriptionId = null;
                user.subscription.type = 'none';

                user.save(utils.errorHandler(res, function() {
                    res.json({
                        user: user
                    });
                }));
            });
        };

        mongoose.models.User.findById(req.params.id, utils.errorHandler(res, userLoaded));
    });

    app.post('/api/v1.0/users/:id', session.isAuthenticated, function(req, res) {
        // TODO: admin also will be able remove/deactivate users
        if (req.user.id !== req.params.id) {
            return res.sendStatus(404);
        }

        var sendResult = function(user) {
                app.emit('audit', 'user.deactivate', req);

                if (!user.isAnonymous) {
                    var emailData = {
                        user: user
                    };

                    req.logout();

                    utils.sendMail(app, 'account_cancelled', user.email, 'Your account has been cancelled', emailData, req, function(err) {
                        if (err) {
                            winston.error('Email sending error:', err);
                        } else {
                            winston.debug('User %s has been deactivated', req.params.id);
                        }
                    });
                }

                req.logout();
                res.sendStatus(204);
            },
            deactivateUser = function(user) {
                if (user) {
                    user.isActive = false;
                    user.save(utils.errorHandler(res, sendResult));
                } else {
                    return res.sendStatus(404);
                }
            },
            deactivateAnonymousUser = function(user) {
                if (!user) {
                    return res.sendStatus(404);
                }

                if (!user.isAnonymous) {
                    return res.status(400).json({
                        message: 'Attempted to deactivate registered user. Please reload page.'
                    });
                }

                user.isActive = false;
                user.save(utils.errorHandler(res, sendResult));
            };

        switch (req.body.action) {
            case 'deactivate':
                mongoose.models.User.findById(req.params.id, utils.errorHandler(res, deactivateUser));
                break;
            case 'deactivateAnonymous':
                mongoose.models.User.findById(req.params.id, utils.errorHandler(res, deactivateAnonymousUser));
                break;
            default:
                return res.status(400).json({
                    message: 'Invalid action'
                });
        }
    });

    app.post('/api/v1.0/users/:id/invite', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.id) {
            return res.sendStatus(404);
        }

        var emails = req.body.emails;
        if (!_.isArray(emails) || (emails.length === 0)) {
            winston.error('Unable to send invitations because emails is not an array');
            return res.sendStatus(400);
        }

        var emailData = {
            inviter: req.user
        };

        app.emit('audit', 'user.invite', {
            req: req,
            emailsArr: emails
        });

        async.each(emails, function(email, onEmailSent) {
            utils.sendMail(app, 'invite_friends', email, 'Join me on Paperjet', emailData, req, function(err) {
                onEmailSent(err);
            });
        }, function(err) {
            if (err) {
                return res.sendStatus(400);
            } else {
                res.sendStatus(204);
            }
        });

    });
};
