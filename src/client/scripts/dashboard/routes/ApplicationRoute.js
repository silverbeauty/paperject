App.ApplicationRoute = Ember.Route.extend({
    promise: null,

    actions: {
        authenticated: function(user) {
            this.onAuthenticated(user);
            this.transitionTo('index.documents');
        },

        registered: function(user) {
            this.onAuthenticated(user);
        }
    },

    onAuthenticated: function(user) {
        this.store.pushPayload('user', {
            users: [user]
        });

        this.store.find('user', user.id).then(_.bind(function(rec) {
            this.modelFor('application').set('profile', rec);
        }, this));

        App.checkProducthunt(this.store);
    },

    afterModel: function(model, transition) {
        //go to 'login' page if user was not logged in
        if (!model.get('profile')) {
            var whitelistedRoutes = ['register', 'application', 'forgot-password', 'reset-password', 'password-reset-success'];
            if (whitelistedRoutes.indexOf(transition.targetName) === -1) {
                this.transitionTo('login');
            }
        }
    },

    model: function() {
        if (!this.promise) {
            this.promise = new Ember.RSVP.Promise(_.bind(function(resolve, reject) {

                if (App.testing) {
                    resolve(Ember.Object.create({
                        profile: null
                    }));

                    this.transitionTo('login');
                    return;
                }

                var request = $.getJSON('/api/v1.0/connection');

                request.done(_.bind(function(data) {
                    if (data.migrated) {
                        App.showAccountNotification('We\'ve migrated data from your Guest session.', true);
                    }

                    this.store.pushPayload('user', {
                        users: [data.user]
                    });

                    this.store.find('user', data.user.id).then(function(rec) {
                        resolve(Ember.Object.create({
                            profile: rec
                        }));
                    });

                    App.checkProducthunt(this.store);
                }, this));

                request.fail(_.bind(function() {
                    resolve(Ember.Object.create({
                        profile: null
                    }));
                }, this));
            }, this));
        }

        return this.promise;
    }
});
