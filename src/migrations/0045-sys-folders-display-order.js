var mongodb = require('mongodb'),
    async   = require('async');

var folders = [{alias: "my-documents", displayOrder: 1}, {alias: "trash", displayOrder:2}];
exports.up = function(db, next){
    var collection = mongodb.Collection(db, 'folders');
    async.each(folders, function(folder, done){
        collection.update({alias: folder.alias}, {$set: {displayOrder: folder.displayOrder}}, {}, function(err){
            done(err);
        });
    }
    ,function(err){
        next(err);
    });
};

exports.down = function(db, next){
    var collection = mongodb.Collection(db, 'folders');
    async.each(folders, function(folder, done){
        collection.update({alias: folder.alias}, {$unset: {displayOrder: false}}, {}, function(err){
            done(err);
        });
    }
    ,function(err){
        next(err);
    });
};
