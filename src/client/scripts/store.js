App.ApplicationAdapter = DS.RESTAdapter;

App.ApplicationSerializer = DS.RESTSerializer.extend({
    primaryKey: '_id'
});

App.ApplicationAdapter = DS.RESTAdapter.extend({
    coalesceFindRequests: false,
    buildURL: function(type, id) {
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

        // Requests to the users route must be like this: api/v1.0/users/:id instead of api/v1.0/users/:id/users/:id
        // Do not add superfluous users/:id to requests to the users route
        // FIX: what if user requests users/<id> object? In this case this code ignores <id> part, and uses App.get('userId') instead
        if (type !== 'user') {
            url.push(Ember.String.pluralize(type));

            if (id) {
                url.push(id);
            }
        }

        url = url.join('/');

        if (!host) {
            url = '/' + url;
        }

        return url;
    }
});


DS.RESTAdapter.reopen({
    namespace: 'api/v1.0',
    coalesceFindRequests: false
});
