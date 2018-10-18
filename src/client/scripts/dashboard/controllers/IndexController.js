/*global Ladda,io,md5,sprintf*/
App.IndexController = Ember.Controller.extend({
    needs: ['application'],
    queryParams: ['subscribe'],
    loggingOut: false,
    clientId: '',
    socket: null,
    isRegProcessing: false,
    activeTabName: 'registration', // FIX: rename to registerModalActiveTabName
    isRegistrationTabActive: Ember.computed.equal('activeTabName', 'registration'),
    isLoginTabActive: Ember.computed.equal('activeTabName', 'login'),
    subscribe: '',
    profile: Ember.computed.alias('controllers.application.model.profile'),

    init: function() {
        this._super();

        var userId = App.get('userId');

        this.socket = App.get('socket');
        this.socket.on('ask-to-register', _.bind(function() {
            if (!$('.modal.in').length && this.get('controllers.application.model.profile.isAnonymous')) {
                $('#register-modal').modal('show');
            }
        }, this));

        this.socket.on('metrics.update', _.bind(this.onMetricsUpdated, this));

        this.socket.on('folder.insert', _.bind(this.onFolderInserted, this));
        this.socket.on('folder.update', _.bind(this.onFolderUpdated, this));
        this.socket.on('folder.remove', _.bind(this.onFolderRemoved, this));
        this.socket.on('document.conversion.start', function() {
            App.showNotification('Converting...');
        });

        Ember.run.next(this, function() {
            // run in next cycle, so notification component is initialized
            this.remindToConfirmEmail();
            this.remindFreeFaxes();
        });
    },

    actions: {
        logout: function() {
            this.set('loggingOut', true);

            var request = $.ajax({
                type: 'DELETE',
                url: '/api/v1.0/connection'
            });

            request.done(function() {
                location.href = '/';
            });

            request.fail(_.bind(function() {
                this.set('loggingOut', false);
                App.showError('Logout failed');
            }, this));
        },

        register: function() {
            // trigger form sumbit to call RegistrationFromComponent's logic
            $('#registration-form').submit();
        },

        login: function() {
            // trigger form sumbit to call RegistrationFromComponent's logic
            $('#login-form').submit();
        },

        //action from RegFormComponent
        registerFormAction: function(data) {
            if (data.action == 'setIsProcessingStatus') {
                this.setProperties({
                    isRegProcessing: data.isProcessing
                });
            } else if (data.action === 'regDone') {
                this.store.pushPayload({
                    users: [data.user]
                });

                $('#register-modal').on('hidden.bs.modal', function(e) {
                    App.showNotification('Thank you for registration! Please check your email to complete registration.');
                });

                $('#register-modal').modal('hide');
            }
        },

        profileUpdate: function(json) {
            var type = this.store.modelFor('user'),
                serializer = this.store.serializerFor(type.typeKey),
                record = serializer.extractSingle(this.store, type, {
                    users: [json]
                });

            this.set('controllers.application.model.profile', this.store.push('user', record));
        }
    },

    userDisplayName: function() {
        if (this.get('profile.isAnonymous')) {
            return 'Guest';
        }

        return this.get('profile.displayName') || this.get('profile.email');
    }.property('profile.email', 'profile.displayName'),

    gravatarProfileBackgroundStyle: function() {
        return sprintf('background-image:url(//secure.gravatar.com/avatar/%s?d=%s);',
            md5(this.get('profile.email')),
            encodeURIComponent(window.location.origin + "/images/user-profile.png")
        ).htmlSafe();
    }.property('profile.email'),

    onMetricsUpdated: function(receivedData) {
        this.set('profile.metrics', receivedData.data);
    },

    onFolderInserted: function(data) {
        if (data.clientId !== App.get('clientId')) {
            this.store.find('folder', data.id);
        }
    },

    onFolderUpdated: function(data) {
        if (data.clientId !== App.get('clientId')) {
            this.store.find('folder', data.id).then(function(rec) {
                if (rec) {
                    if (rec.get('isDirty')) {
                        var onSave = function() {
                            rec.reload();
                            rec.off('didUpdate', onSave);
                        };

                        rec.on('didUpdate', onSave);
                    } else {
                        rec.reload();
                    }
                }
            });
        }
    },

    onFolderRemoved: function(data) {
        if (data.clientId !== App.get('clientId')) {
            this.store.find('folder', data.id).then(function(rec) {
                if (rec) {
                    rec.unloadRecord();
                }
            });
        }
    },

    remindFreeFaxes: function() {
        // run later to ensure that PRO promo is applied
        Ember.run.later(this, function() {
            var profile = this.get('profile');
            if (profile.get('metrics.freeFaxPages') > 0) {
                var nextTip = profile.get('tips.freeFaxPages');

                // TODO: freeFaxPages should be Date in model
                if (nextTip && new Date(nextTip).getTime() <= Date.now()) {
                    profile.set('tips.freeFaxPages', new Date(Date.now() + 24 * 60 * 60 * 1000)); // every day
                    profile.save();

                    App.showAccountNotification(sprintf('You may send %s free fax pages!', profile.get('metrics.freeFaxPages')));
                }
            }
        }, 5000);
    },

    remindToConfirmEmail: function() {
        var profile = this.get('profile');
        if (!profile.get('isEmailConfirmed')) {
            var nextTip = profile.get('tips.confirmEmail');

            // TODO: confirmEmail should be Date in model
            if (nextTip && new Date(nextTip).getTime() <= Date.now()) {
                profile.set('tips.confirmEmail', new Date(Date.now() + 60 * 60 * 1000)); // every hour
                profile.save();
                Ember.run.later(this, this.remindToConfirmEmail, 61 * 60 * 1000);
                App.showNotification(App.CONFIRM_EMAIL_MESSAGE);
            }
        }
    },

    showSubscriptionModal: function() {
        if (this.get('subscribe') === 'pro') {
            Ember.run.scheduleOnce('afterRender', function() {
                $('#payment-dialog').modal('show');
            });

            this.set('subscribe', '');
        }
    }.observes('subscribe')
});
