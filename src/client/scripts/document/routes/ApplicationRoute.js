App.ApplicationRoute = Ember.Route.extend({
    promise: null,
    loginTransition: null,

    actions: {
        authenticated: function(user) {
            this.store.pushPayload('user', {
                users: [user]
            });

            this.store.find('user', user.id).then(_.bind(function(rec) {
                this.modelFor('application').set('profile', rec);

                if (this.loginTransition) {
                    this.loginTransition.retry();
                    this.loginTransition = null;
                } else {
                    this.replaceWith('doc', this.controllerFor('login').get('doc'));
                }
            }, this));

            App.checkProducthunt(this.store);
        }
    },

    model: function(params, transition) {
        if (!this.promise) {
            this.promise = new Ember.RSVP.Promise(_.bind(function(resolve, reject) {
                // if (App.testing) {
                //     resolve(Ember.Object.create({
                //         profile: null
                //     }));
                //
                //     this.transitionTo('login');
                //     this.controllerFor('login').on('login', this, this.onLogin);
                //     return;
                // }

                var doc = _.get(transition, 'params.doc.id') || _.get(transition, 'queryParams.doc'),
                    request = $.getJSON('/api/v1.0/connection' + (doc ? '?doc=' + doc : ''));

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

                request.fail(_.bind(function(xhr) {
                    if (transition.queryParams.form) {
                        var objectId = function() {
                                // http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
                                return 'xxxxxxxxxxxx4xxxyxxxxxxx'.replace(/[xy]/g, function(c) {
                                    var r = Math.random() * 16 | 0,
                                        v = c == 'x' ? r : (r & 0x3 | 0x8);
                                    return v.toString(16);
                                });
                            },
                            userId = 'non-registered-user-' + objectId();

                        this.store.pushPayload('user', {
                            users: [{
                                _id: userId,
                                isNonRegisteredUser: true
                            }]
                        });

                        this.store.find('user', userId).then(function(rec) {
                            resolve(Ember.Object.create({
                                profile: rec
                            }));
                        });

                        return;
                    }

                    resolve(Ember.Object.create({
                        profile: null,
                        signatureRequest: xhr.responseJSON ? xhr.responseJSON.signatureRequest : null // for login
                    }));

                    if (transition.targetName !== 'login') {
                        this.loginTransition = transition;
                        this.transitionTo('login', {
                            queryParams: {
                                doc: transition.params.doc.id
                            }
                        });
                    }
                }, this));
            }, this));
        }

        return this.promise;
    }
});
