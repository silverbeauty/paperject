var mongoose = require('mongoose'),
    winston = require('winston'),
    config = require('../config')(),
    monitoringUserId = '';

var createAuditRecord = function(req, type, operation, id, data) {
        var audit = {
            type: type,
            operation: operation,
            itemId: id,
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        };

        if (req.user) {
            audit.user = req.user.id;
        }

        if (data) {
            audit.data = data;
        }

        if (audit.user !== monitoringUserId) {
            mongoose.models.Audit.create(audit);
        }
    },
    onProviderUserCreate = function(data) {
        var id = data.id;
        delete data.id;
        console.log('******************')
        console.log(data);
        mongoose.models.Audit.create({
            user: id,
            type: 'user',
            operation: 'insert',
            itemId: id,
            data: data
        });
    },
    onEmail = function(req, data) {
        var user = req.user || data.user,
            rec = {
                type: 'email',
                data: data
            };

        // user is not set when support form is submitted
        if (user) {
            rec.user = user.id;
        }

        if (req.headers && req.headers['x-forwarded-for'] || req.connection) {
            rec.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        }

        mongoose.models.Audit.create(rec);
    },
    onProviderUserLogin = function(user) {
        mongoose.models.Audit.create({
            user: user.id,
            type: 'user',
            operation: 'login',
            itemId: user.id,
            data: {
                authType: user.authType,
                email: user.email
            }
        });
    },
    onUserOperation = function(req, operation) {
        if (req.user.id !== monitoringUserId) {
            mongoose.models.Audit.create({
                user: req.user.id,
                type: 'user',
                operation: operation,
                itemId: req.user.id,
                ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                data: {
                    email: req.user.email
                }
            });
        }
    };

module.exports = function(app) {
    if (config.monitoring.user) {
        mongoose.models.User.findOne({
            email: config.monitoring.user
        }, function(err, user) {
            if (!err && user) {
                monitoringUserId = user.id + '';
                winston.info('Found monitoring user', monitoringUserId);
            }
        });
    }

    app.on('audit', function(name, data) {
        switch (name) {
            case 'provider.user.create':
                onProviderUserCreate(data);
                break;
            case 'provider.user.login':
                onProviderUserLogin(data);
                break;
            case 'user.login':
                onUserOperation(data, 'login');
                break;
            case 'user.logout':
                onUserOperation(data, 'logout');
                break;
            case 'user.deactivate':
                onUserOperation(data, 'deactivate');
                break;
            case 'user.invite':
                createAuditRecord(data.req, 'user', 'invite', data.req.user.id, {
                    emails: data.emailsArr.join(',')
                });
                break;
            case 'user.invited':
                createAuditRecord(data.req, 'user', 'invited', data.req.user.id, {
                    inviterId: data.inviter.id,
                    inviterEmail: data.inviter.email,
                    inviterUploadsQuota: data.inviter.metrics.uploadsQuota,
                    inviteeId: data.invitee.id,
                    inviteeEmail: data.invitee.email
                });
                break;
            case 'document.insert':
                data.req.user.metrics.lastUpload = new Date();
                data.req.user.save();
                createAuditRecord(data.req, 'document', 'insert', data.data.id, data.data);
                break;
            case 'document.update':
                // audit data differs from public data, so handle document events separately
                createAuditRecord(data.req, 'document', 'update', data.data.id, data.data);
                break;
            case 'document.delete':
                // audit data differs from public data, so handle document events separately
                createAuditRecord(data.req, 'document', 'delete', data.data.id, data.data);
                break;
            case 'document.email':
                data.req.user.metrics.lastSentEmail = new Date();
                data.req.user.save();
                createAuditRecord(data.req, 'document', 'email', data.data.id, data.data);
                break;
            case 'document.fax':
                data.req.user.metrics.lastSentFax = new Date();
                data.req.user.save();
                createAuditRecord(data.req, 'document', 'fax', data.data.id, data.data);
                break;
            case 'document.download':
                data.req.user.metrics.lastDownload = new Date();
                data.req.user.save();
                createAuditRecord(data.req, 'document', 'download', data.data.id, data.data);
                break;
            case 'document.print':
                data.req.user.metrics.lastPrint = new Date();
                data.req.user.save();
                createAuditRecord(data.req, 'document', 'print', data.data.id, data.data);
                break;
            case 'page.update':
                data.req.user.metrics.lastPageUpdate = new Date();
                data.req.user.save();
                createAuditRecord(data.req, 'page', 'update', data.data.id, data.data);
                break;
            case 'payment.fax':
                createAuditRecord(data.req, 'payment', 'fax', data.data.id, data.data);
                break;
            case 'payment.subscription.create':
                createAuditRecord(data.req, 'payment', 'subscription.create', data.data.id, data.data);
                break;
            case 'payment.subscription.cancel':
                createAuditRecord(data.req, 'payment', 'subscription.cancel', data.id, data.data);
                break;
            case 'payment.customer.create':
                createAuditRecord(data.req, 'payment', 'customer.create', data.id, data.data);
                break;
            case 'payment.customer.update':
                createAuditRecord(data.req, 'payment', 'customer.update', data.id, data.data);
                break;
            case 'email':
                onEmail(data.req, data.data);
                break;
            case 'form.email':
                createAuditRecord(data.req, 'form', 'email', data.id, data.data);
                break;
        }
    });

    app.on('dbupdate', function(req, model, operation, id, data) {
        if (model === 'signature' || model === 'folder' || model === 'user') {
            createAuditRecord(req, model, operation, id, data);
        }
    });
};
