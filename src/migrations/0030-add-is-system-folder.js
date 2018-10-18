var mongodb = require('mongodb'),
    async   = require('async');

var folders = [{alias: "inbox"}, {alias: "sent"}, {alias: "trash"}];
exports.up = function(db, next){
    var collection = mongodb.Collection(db, 'folders');
    async.each(folders, function(folder, done){
        collection.update({alias: folder.alias}, {$set: {isSystemFolder: true}}, {}, function(err){
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
        collection.update({alias: folder.alias}, {$set: {isSystemFolder: false}}, {}, function(err){
            done(err);
        });
    }
    ,function(err){
        next(err);
    });
};
