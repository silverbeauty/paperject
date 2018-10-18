var mongoose = require('mongoose'),
    connectionString = process.env.CONNECTION_STRING,
    test = function() {
        var schema = new mongoose.Schema({
            n1: Number,
            n2: Number,
            n3: Number,
            n4: Number,
            s1: String,
            s2: String,
            s3: String,
            s4: String,
            d1: Date,
            d2: Date,
            d3: Date,
            d4: Date
        });

        mongoose.model('PerformanceTest', schema);

        var count = 1000,
            error = function(err) {
                console.error(err);
                process.exit();
            },
            createFn = function() {
                mongoose.models.PerformanceTest.create({
                    n1: count,
                    n2: count,
                    n3: count,
                    n4: count,
                    s1: 'String' + count,
                    s2: 'String' + count,
                    s3: 'String' + count,
                    s4: 'String' + count,
                    d1: new Date(),
                    d2: new Date(),
                    d3: new Date(),
                    d4: new Date()
                }, function(err) {
                    if (err) {
                        error(err);
                        return;
                    }

                    if (--count === 0) {
                        console.timeEnd('Insert');
                        console.time('Find');

                        mongoose.models.PerformanceTest.find({}, function(err, recs) {
                            if (err) {
                                error(err);
                                return;
                            }

                            console.timeEnd('Find');

                            console.time('Remove');

                            mongoose.models.PerformanceTest.remove({}, function(err) {
                                if (err) {
                                    error(err);
                                    return;
                                }

                                console.timeEnd('Remove');
                                console.log('');
                                process.exit();
                            });
                        });
                    } else {
                        createFn();
                    }
                });
            };

        mongoose.models.PerformanceTest.remove({}, function() {
            console.time('Insert');
            createFn();
        });
    };

mongoose.connect(connectionString, {
    db: {
        safe: true
    }
}, function(err, res) {
    if (err) {
        console.error('ERROR connecting to %s: %s.', connectionString, err);
    } else {
        test();
    }
});
