'use strict';

module.exports = function(app, server, cookieSession) {
    var io = require('socket.io').listen(server),
        mongoose = require('mongoose'),
        winston = require('winston'),
        _ = require('lodash'), // jshint ignore:line
        config = require('./config')(),
        mq = require('./common/server/mq'),
        createRedisAdapter = function() {
            var redis = require('redis'),
                socketRedis = require('socket.io-redis'),
                socketioPub = redis.createClient(config.redis.port, config.redis.host, {
                    detect_buffers: true,
                    retry_max_delay: 10000,
                    auth_pass: config.redis.password
                }),
                socketioSub = redis.createClient(config.redis.port, config.redis.host, {
                    detect_buffers: true,
                    retry_max_delay: 10000,
                    auth_pass: config.redis.password
                }),
                pubConnected = false,
                subConnected = false,
                initialize = true,
                initializeAdapter = function() {
                    // this function is needed to handle situation when Redis is down when app starts
                    if (pubConnected && subConnected && initialize) {
                        initialize = false;
                        winston.info('Initialize socket.io-redis.');

                        io.adapter(socketRedis({
                            pubClient: socketioPub,
                            subClient: socketioSub
                        }));
                    }
                };

            socketioPub.on('error', function(err) {
                winston.error(err + '');
            });

            socketioSub.on('error', function(err) {
                winston.error(err + '');
            });

            socketioPub.on('ready', function(err) {
                pubConnected = true;
                initializeAdapter();
            });

            socketioSub.on('ready', function(err) {
                subConnected = true;
                initializeAdapter();
            });
        };

    createRedisAdapter();

    io.use(function(socket, next) {
        var handshakeData = socket.request,
            req = {
                connection: {},
                headers: handshakeData.headers
            },
            res = {
                getHeader: function() {
                    return "";
                },
                setHeader: function() {}
            },
            callback = function() {
                if (req.session && req.session.passport && req.session.passport.user) {
                    mongoose.models.User.findById(req.session.passport.user, '-password', function(err, user) {
                        if (user) {
                            handshakeData.user = user;
                            next();
                            return;
                        }

                        next(new Error('User not found'));
                    });
                } else {
                    next();
                }
            };

        cookieSession(req, res, callback);
    });

    io.sockets.on('connection', function(socket) {
        var userId = _.get(socket, 'conn.request.user.id');

        if (userId) {
            socket.join('registered-' + userId);
        } else {
            socket.join('non-registered');
        }
    });

    app.on('dbupdate', function(req, model, operation, id, data) {
        if (req.user) {
            if (arguments.length !== 5) {
                winston.error('Wrond number of arguments in dbupdate event', model, operation);
            }

            var dataToBeSent = {
                clientId: req.headers.clientid,
                id: id
            };

            if (data) {
                dataToBeSent.data = data;
            }

            io.to('registered-' + req.user.id).emit(model + '.' + operation, dataToBeSent);
        }
    });

    app.on('ask-to-register', function(userId) {
        io.to('registered-' + userId).emit('ask-to-register');
    });

    app.on('document.conversion.start', function(userId) {
        io.to('registered-' + userId).emit('document.conversion.start');
    });

    app.on('sentItem.insert', function(data) {
        io.to('registered-' + data.userId).emit('sentItem.insert', {
            id: data.id,
            data: data.data
        });
    });

    app.on('sentItem.insert', function(data) {
        io.sockets.emit(data.userId + '.sentItem.insert', {
            id: data.id,
            data: data.data
        });
    });

    mq.subscribe('page.insert', function(data) {
        io.to('registered-' + data.userId).emit('page.insert', {
            page: data.page
        });
    });

    mq.subscribe('document.update', function(data) {
        io.to('registered-' + data.userId).emit('document.update', {
            id: data.id,
            data: data.data
        });
    });

    mq.subscribe('document.delete', function(data) {
        io.to('registered-' + data.userId).emit('document.delete', {
            id: data.id
        });
    });

    mq.subscribe('signature.insert', function(data) {
        io.to('registered-' + data.userId).emit('signature.insert.' + data.taskId, {
            id: data.id,
            rec: data.rec
        });
    });

    mq.subscribe('signature.fail', function(data) {
        io.to('registered-' + data.userId).emit('signature.fail.' + data.taskId, {
            message: data.message
        });
    });

    mq.subscribe('pdf.insert', function(data) {
        io.to('registered-' + data.userId).emit('doc.' + data.doc + '.pdf.insert');
    });

    mq.subscribe('sentItem.update', function(data) {
        io.to('registered-' + data.userId).emit('sentItem.update', {
            id: data.sentItem
        });
    });

    mq.subscribe('non-registered-user.signature.insert', function(data) {
        io.to('non-registered').emit('non-registered-user-' + data.userId + '.signature.insert.' + data.taskId, {
            id: data.id,
            rec: data.rec
        });
    });

    mq.subscribe('sentItem.update', function(data) {
        io.sockets.emit(data.userId + '.sentItem.update', {
            id: data.sentItem
        });
    });
};
