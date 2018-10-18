/*global io*/
App.DocRoute = Ember.Route.extend({
    promise: null,

    showErrorForm: function() {
        Ember.run.scheduleOnce('afterRender', function() {
            $('#doc-route-error-modal').modal({
                keyboard: false,
                backdrop: 'static'
            });
        });
    },

    loadSharedForm: function(params) {
        var store = this.store,
            userId = this.modelFor('application').get('profile.id'),
            showErrorForm = this.showErrorForm;

        return new Ember.RSVP.Promise(function(resolve, reject) {
            var socket = io();

            socket.on('connect', function(client) {
                App.setProperties({
                    socket: socket,
                    clientId: socket.io.engine.id,
                    userId: userId
                });

                var request = $.getJSON('/api/v1.0/documents/' + params.id + '/forms/' + params.formId);

                request.done(function(data) {
                    store.pushPayload(data);

                    store.find('form', params.formId).then(function(form) {
                        resolve({
                            form: form,
                            doc: form.get('doc'),
                            pages: Ember.A(store.all('page').toArray())
                        });
                    });
                });

                request.fail(function() {
                    reject({
                        form: params.formId
                    });

                    showErrorForm();
                });
            });
        });
    },

    loadDocument: function(params) {
        return new Ember.RSVP.Promise(_.bind(function(resolve, reject) {
            var socket = io(),
                userId = this.modelFor('application').get('profile.id'),
                showErrorForm = this.showErrorForm;

            socket.on('connect', _.bind(function(client) {
                App.setProperties({
                    socket: socket,
                    clientId: socket.io.engine.id,
                    userId: userId
                });

                socket.on(App.get('userId') + '.user.insert', _.bind(function(data) {
                    if (data.clientId !== App.get('clientId')) {
                        var request = $.getJSON('/api/v1.0/connection');

                        request.done(_.bind(function(data) {
                            this.store.pushPayload('user', {
                                users: [data.user]
                            });
                        }, this));
                    }
                }, this));

                this.store.find('signature');

                this.store.find('document', params.id).then(_.bind(function(doc) {
                    resolve({
                        doc: doc,
                        pages: Ember.A(this.store.all('page').toArray())
                    });
                }, this)).catch(function(e) { // jshint ignore:line
                    reject({
                        wrongOwner: e.status === 403
                    });
                    showErrorForm();
                });

                socket.on('page.insert', _.bind(this.onPageInsert, this));
            }, this));
        }, this));
    },

    model: function(params) {
        if (!this.promise) {
            if (params.formId) {
                this.promise = this.loadSharedForm(params);
            } else {
                this.promise = this.loadDocument(params);
            }
        }

        return this.promise;
    },

    onPageInsert: function(data) {
        if (data && data.page && data.page.doc === this.get('controller.content.doc.id')) {
            var type = this.store.modelFor('page'),
                serializer = this.store.serializerFor(type.typeKey),
                record = serializer.extractSingle(this.store, type, {
                    pages: [data.page]
                }),
                page = this.store.push('page', record);

            this.get('controller.content.pages').addObject(page);
        }
    }
});
