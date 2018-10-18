/*global io*/
App.IndexRoute = Ember.Route.extend({
    promise: null,

    beforeModel: function(transition) {
        if (transition.targetName === 'index.index') {
            this.replaceWith('index.documents');
        }

        this._super();
    },

    model: function() {
        if (!this.promise) {
            this.promise = new Ember.RSVP.Promise(_.bind(function(resolve, reject) {
                var socket = io();

                socket.on('connect', _.bind(function(client) {
                    App.setProperties({
                        socket: socket,
                        clientId: socket.io.engine.id,
                        userId: this.modelFor('application').get('profile.id')
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

                    resolve(Ember.Object.create({
                        profile: this.modelFor('application').get('profile')
                    }));
                }, this));
            }, this));
        }

        return this.promise;
    }
});
