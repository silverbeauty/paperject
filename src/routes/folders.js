'use strict';

var session = require('../middleware/session'),
    mongoose = require('mongoose'),
    sprintf = require('sprintf'), // jshint ignore:line
    utils = require('../utils'),
    sendFolder = function(res, req, app, operation) {
        return function(rec) {
            if (!rec) {
                return res.sendStatus(404);
            }

            if (req && app && operation) {
                app.emit('dbupdate', req, 'folder', operation, rec._id, {
                    name: rec.name
                });
            }

            res.json({
                folder: rec
            });
        };
    };

module.exports = function(app) {
    app.get('/api/v1.0/users/:userId/folders/:id', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own folders
        }

        var query = {
            user: req.params.userId,
            _id: req.params.id
        };
        mongoose.models.Folder.findOne(query, utils.errorHandler(res, function(folder) {
            if (folder) {
                res.json({
                    folder: folder
                });
            } else {
                res.sendStatus(404);
            }
        }));
    });

    app.post('/api/v1.0/users/:userId/folders', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own folders
        }

        // delete displayOrder and let mongoose to take care about default value
        if (!req.body.folder.displayOrder) {
            delete req.body.folder.displayOrder;
        }

        delete req.body.folder.shared;
        req.body.folder.user = req.user;
        mongoose.models.Folder.create(req.body.folder, function(err, folder) {
            if (err) {
                var error;
                if ((err.code == 11000) || (err.code == 11001)) {
                    error = sprintf('Folder \'%s\' is already exist', req.body.folder.name);
                } else {
                    error = err + '';
                }
                return res.status(400).json({
                    message: error
                });
            } else {
                sendFolder(res, req, app, 'insert')(folder);
            }
        });
        //utils.errorHandler(res, sendFolder(res, req, app, 'insert')));
    });

    app.put('/api/v1.0/users/:userId/folders/:id', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can change only own folders
        }

        var updateFolder = function(rec) {
            if (!rec || !rec.user || (rec.user + '') !== req.user.id) {
                return res.sendStatus(404);
            }

            if (rec.updatedAt.getTime() !== Date.parse(req.body.folder.updatedAt)) {
                return res.sendStatus(409);
            }

            rec.set(req.body.folder);
            rec.save(utils.errorHandler(res, sendFolder(res, req, app, 'update')));
        };

        mongoose.models.Folder.findById(req.params.id, utils.errorHandler(res, updateFolder));
    });

    app['delete']('/api/v1.0/users/:userId/folders/:id', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can delete only own folders
        }

        var query = {
            _id: req.params.id,
            user: req.user.id
        };

        mongoose.models.Folder.remove(query, utils.errorHandler(res, function() {
            app.emit('dbupdate', req, 'folder', 'delete', req.params.id, null);
            res.sendStatus(204);
        }));
    });
};
