'use strict';

/*global Ladda*/
App.ForgotPasswordFormComponent = Ember.Component.extend({
    isProcessing: false,
    isError: false,
    alertMessage: '',
    email: '',

    didInsertElement: function() {
        this.initSpinner();
        $('#' + this.get('emailField.elementId')).focus();
    },

    initSpinner: function() {
        var spinner = Ladda.create($('#request-pwd-reset-btn')[0]);

        this.addObserver('isProcessing', this, function() {
            if (this.get('isProcessing')) {
                spinner.start();
            } else {
                spinner.stop();
            }
        });
    },

    actions: {
        sendPasswordResetLink: function() {
            this.set('alertMessage', '');

            var data = this.getProperties('email');
            data.action = 'send-reset-password-link';

            this.setProperties({ isProcessing: true });

            var request = $.post('/api/v1.0/connection', data);
            request.done(_.bind(this.onLinkSent, this));
            request.fail(_.bind(this.onRequestFailed, this));
            request.always(_.bind(function(){
                this.setProperties({ isProcessing: false });
            }, this));
        }
    },

    onLinkSent: function(response){
        this.setProperties({
            isError: false,
            alertMessage: 'We have sent you an email with instructions to reset password'
        });

        this.setProperties({email: ''});
    },

    onRequestFailed: function(jqXHR, textStatus, errorThrown){
        this.setProperties({
            isError: true,
            alertMessage: jqXHR.responseJSON.message
        });
    }
});
