App.Page = DS.Model.extend({
    i: DS.attr('number'),
    doc: DS.belongsTo('document'),
    status: DS.attr('string'),
    ffd: DS.attr('string'),
    fontSize: DS.attr('number'), // in 1/10000 of page size, optional. If not defined, use 'h'
    h: DS.attr('number'), // in 1/10000 of page size
    w: DS.attr('number'), // in 1/10000 of page size
    nextObjectId: DS.attr('number'),
    objects: DS.attr(), // array
    createdAt: DS.attr('date'),
    updatedAt: DS.attr('date')
});

App.PageSerializer = DS.RESTSerializer.extend({
    primaryKey: '_id',

    serialize: function(snapshot, options) {
        var json = this._super(snapshot, options),
            objects = json.objects || [],
            obj;

        for (var i = 0; i < objects.length; i++) {
            obj = objects[i];

            if (obj.h) {
                obj.h = parseInt(obj.h, 10);
            }

            if (obj.w) {
                obj.w = parseInt(obj.w, 10);
            }

            if (obj.x) {
                obj.x = parseInt(obj.x, 10);
            }

            if (obj.y) {
                obj.y = parseInt(obj.y, 10);
            }

            delete obj.readOnly;
        }

        return json;
    },

    normalize: function(type, hash, prop) {
        this.extractPageObject(hash);
        return this._super(type, hash, prop);
    },

    extractPageObject: function(page) {
        if (page.objects) {
            for (var j = 0; j < page.objects.length; j++) {
                page.objects[j] = Ember.Object.create(page.objects[j]);

                if (page.objects[j].style) {
                    page.objects[j].style = Ember.Object.create(page.objects[j].style);
                }
            }

            page.objects = Ember.A(page.objects);
        }
    }
});

App.PageAdapter = DS.RESTAdapter.extend({
    coalesceFindRequests: false,
    buildPageUrl: function(doc, id) {
        var host = Ember.get(this, 'host'),
            namespace = Ember.get(this, 'namespace'),
            url = [];

        if (host) {
            url.push(host);
        }

        if (namespace) {
            url.push(namespace);
        }

        url.push('users');
        url.push(App.get('userId'));
        url.push('documents');
        url.push(doc);
        url.push('pages');

        if (id) {
            url.push(id);
        }

        url = url.join('/');

        if (!host) {
            url = '/' + url;
        }

        return url;
    },

    findQuery: function(store, type, query) {
        return this.ajax(this.buildPageUrl(query.doc), 'GET');
    },

    updateRecord: function(store, type, snapshot) {
        var data = {};
        var serializer = store.serializerFor(type.typeKey);

        serializer.serializeIntoHash(data, type, snapshot);

        return this.ajax(this.buildPageUrl(snapshot.belongsTo('doc').id, snapshot.id), "PUT", {
            data: data
        });
    }
});
