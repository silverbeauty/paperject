App.Folder = DS.Model.extend({
    name: DS.attr('string'),
    alias: DS.attr('string'),
    displayOrder: DS.attr('number'),
    isSystemFolder: DS.attr('boolean'),
    shared: DS.attr('boolean'),
    createdAt: DS.attr('date'),
    updatedAt: DS.attr('date'),
    documents: DS.hasMany('document'),
    newDocumentsCount: function(){
        var count = 0;
        this.get('documents').forEach(function(doc){
            if (!doc.get('isMovedToTrash') && !doc.get('isViewed')){
                count++;
            }
        });
        return count;
    }.property('documents.@each.isViewed'),
    documentsCount: function(){
        var count = 0;
        this.get('documents').forEach(function(doc){
            if (!doc.get('isMovedToTrash')){
                count++;
            }
        });
        return count;
    }.property('documents.@each.isMovedToTrash'),
    isTrash: Ember.computed.equal('alias', 'trash'),
    isInbox: Ember.computed.equal('alias', 'inbox'),
    isMyDocuments: Ember.computed.equal('alias', 'my-documents'),
    isHidden: function() {
        return this.get('isInbox') && this.get('documentsCount') === 0;
    }.property('isInbox', 'documentsCount')

    // TODO: decide how to declare 'non-persistent' fields
    //'non-persistent' fields
    //isSelectedAsDestination: Bool
    //isActive: Bool
});


App.FolderSerializer = DS.RESTSerializer.extend({
    primaryKey: '_id'
});
