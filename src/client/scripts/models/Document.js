App.Document = DS.Model.extend({
    name: DS.attr('string'),
    // file: DS.attr('string'),
    // pages: DS.attr(), // [{ i: 0, objects: [...] }, { i: 2, objects: [...] }]
    createdAt: DS.attr('date'),
    updatedAt: DS.attr('date'),
    compositeUpdatedAt: DS.attr('date'),
    folders: DS.hasMany('folder'),
    shared: DS.attr('boolean'),
    isViewed: DS.attr('boolean'),
    readOnly: DS.attr('boolean'),
    isTemplate: DS.attr('boolean'),
    validation: DS.attr('string'),
    signatureRequest: DS.attr('boolean'),
    pageCount: DS.attr('number'),
    fileUrl: DS.attr('string'),
    printUrl: DS.attr('string'),
    previewUrlRoot: DS.attr('string'),
    isMovedToTrash: function() {
        try {
            return this.get('folders').findBy('alias', 'trash');
        }
        catch(e) {
            // relationship has not been loaded, mark the doc as deleted
            // FIX: put this doc in the MyDocuments. Othervise it will be lost, and remain in the system forever
            return true;
        }
    }.property('folders'),
    editUrl: function() {
        return '/document/' + this.get('id');
    }.property('id')
    // author: DS.belongsTo('user'),

    // TODO: decide how to declare 'non-persistent' fields
    //'non-persistent' fields
    //indexOnPage: Number
    //isSelected: Boolean
});

App.DocumentSerializer = DS.RESTSerializer.extend({
    primaryKey: '_id',

    extract: function(store, type, payload, id, requestType) {
        var doc = this._super(store, type, payload, id, requestType);

        if (doc.pages) {
            for (var i = 0; i < doc.pages.length; i++) {
                var page = doc.pages[i];

                if (page.objects) {
                    for (var j = 0; j < page.objects.length; j++) {
                        page.objects[j] = Ember.Object.create(page.objects[j]);
                    }

                    page.objects = Ember.A(page.objects);
                }

                doc.pages[i] = Ember.Object.create(doc.pages[i]);
            }

            doc.pages = Ember.A(doc.pages);
        }

        return doc;
    }
});
