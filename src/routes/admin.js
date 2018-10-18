'use strict';

var mongoose = require('mongoose'),
    utils = require('../utils'),
    session = require('../middleware/session'),
    _ = require('lodash'); // jshint ignore:line

module.exports = function(app) {
    app.get('/api/v1.0/admin/stats', session.isAuthenticated, function(req, res) {
        if (!req.user.get('isAdmin')) {
            res.sendStatus(404);
            return;
        }

        var match = {},
            range = 14, // 14 days
            dateGroupFormat = [{
                    $substr: [{
                        $year: '$createdAt'
                    }, 0, 4]
                },
                '-', {
                    $cond: [{
                        $lte: [{
                            $month: '$createdAt'
                        }, 9]
                    }, {
                        $concat: [
                            '0', {
                                $substr: [{
                                    $month: '$createdAt'
                                }, 0, 2]
                            }
                        ]
                    }, {
                        $substr: [{
                            $month: '$createdAt'
                        }, 0, 2]
                    }]
                },
                '-', {
                    $cond: [{
                        $lte: [{
                            $dayOfMonth: '$createdAt'
                        }, 9]
                    }, {
                        $concat: [
                            '0', {
                                $substr: [{
                                    $dayOfMonth: '$createdAt'
                                }, 0, 2]
                            }
                        ]
                    }, {
                        $substr: [{
                            $dayOfMonth: '$createdAt'
                        }, 0, 2]
                    }]
                }
            ];

        if (req.query.range) {
            range = Math.min(+req.query.range, 30);

            if (range <= 0) {
                range = 14;
            }
        }

        if (range === 1) {
            dateGroupFormat.push('-');

            dateGroupFormat.push({
                $cond: [{
                    $lte: [{
                        $hour: '$createdAt'
                    }, 9]
                }, {
                    $concat: [
                        '0', {
                            $substr: [{
                                $hour: '$createdAt'
                            }, 0, 2]
                        }
                    ]
                }, {
                    $substr: [{
                        $hour: '$createdAt'
                    }, 0, 2]
                }]
            });

            dateGroupFormat.push(':00');
        } else {
            range += 1;
        }

        match.createdAt = {
            $gte: new Date(Date.now() - range * 24 * 60 * 60 * 1000)
        };

        if (req.query.type) {
            var typeValues = mongoose.models.Audit.schema.paths.type.enumValues;

            _.each(typeValues, function(t) {
                if (req.query.type.indexOf(t + '.') === 0) {
                    var operationValues = mongoose.models.Audit.schema.paths.operation.enumValues;

                    _.each(operationValues, function(op) {
                        if (req.query.type === (t + '.' + op)) {
                            match.type = t;
                            match.operation = op;
                            return false;
                        }
                    });

                    return false;
                }
            });
        }

        mongoose.models.Audit.aggregate([{
            $match: match
        }, {
            $project: {
                dateStr: {
                    $concat: dateGroupFormat
                },
                op: {
                    $concat: ['$type', '.', '$operation']
                }
            }
        }, {
            $group: {
                _id: {
                    date: '$dateStr',
                    op: '$op'
                },
                count: {
                    $sum: 1
                }
            }
        }, {
            $sort: {
                _id: 1
            }
        }], utils.errorHandler(res, function(data) {
            var dates = [],
                series = [],
                result = [];

            _.each(data, function(item) {
                if (!_.includes(dates, item._id.date)) {
                    dates.push(item._id.date);
                }

                if (!_.includes(series, item._id.op)) {
                    series.push(item._id.op);
                }
            });

            _.each(series, function(s) {
                var values = [];

                _.each(dates, function(date) {
                    var value = 0;

                    _.each(data, function(item) {
                        if (item._id.op === s && item._id.date === date) {
                            value = item.count;
                            return false;
                        }
                    });

                    values.push(value);
                });

                result.push({
                    name: s || 'other',
                    data: values
                });
            });

            if (dates.length) {
                dates.splice(dates.length - 1, 1);

                _.each(result, function(r) {
                    r.data.splice(r.data.length - 1, 1);
                });
            }

            res.json({
                series: result,
                dates: dates
            });
        }));
    });
};
