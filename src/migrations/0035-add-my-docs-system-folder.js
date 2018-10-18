var mongodb = require('mongodb'),
    async   = require('async');

var folders = [{alias: "my-documents", name:"My Documents"}];

exports.up = function(db, next){
    var collection = mongodb.Collection(db, 'folders');

    async.each(folders, function(folder, done){
        folder.createdAt = new Date();
        folder.updatedAt = new Date();
        folder.isSystemFolder = true;
        collection.insert(folder, {}, function(err){
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
        collection.findAndRemove({alias: folder.alias}, {}, function(err){
            done(err);
        });
    }
    ,function(err){
        next(err);
    });
};
