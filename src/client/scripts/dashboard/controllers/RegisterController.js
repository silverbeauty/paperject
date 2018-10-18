App.RegisterController = Ember.Controller.extend(Ember.Evented, {
    needs: ['application'],
    isProcessing: false,
    queryParams: ['subscribe', 'inviteId'],
    subscribe: '',
    inviteId: '',

    actions: {
        register: function() {
            // trigger form's submit to call RegistrationFormComponent's logic
            $('#registration-form').submit();
        },
        //action from RegFormComponent
        registerFormAction: function(data) {
            if (data.action == 'setIsProcessingStatus') {
                this.setProperties({
                    isProcessing: data.isProcessing
                });
            } else if (data.action === 'regDone') {
                this.store.pushPayload({
                    users: [data.user]
                });

                this.store.find('user', data.user.id).then(_.bind(function(rec) {
                    this.set('controllers.application.model.profile', rec);

                    this.transitionToRoute('index.documents', {
                        queryParams: {
                            subscribe: this.get('subscribe')
                        }
                    }).then(function() {
                        Ember.run.scheduleOnce('afterRender', this, function() {
                            App.showNotification(App.CONFIRM_EMAIL_MESSAGE);
                        });
                    });
                }, this));
            }
        }
    }
});
