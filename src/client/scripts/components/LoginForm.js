'use strict';

/*global Ladda*/
App.LoginFormComponent = Ember.Component.extend({
    loginFailed: false,
    isProcessing: false,
    loginErrorMessage: '',
    username: '',
    password: '',
    canRegister: true,

    actions: {
        login: function() {
            this.setProperties({
                loginFailed: false,
                isProcessing: true
            });

            var args = this.getProperties('username', 'password', 'action');
            args.action = 'login';
            var request = $.post('/api/v1.0/connection', args);
            request.done(_.bind(this.onLoginSuccess, this));
            request.fail(_.bind(this.onLoginFail, this));
        }
    },

    didInsertElement: function() {
        this._super();
        this.initLoginSpinner();
        $('#' + this.get('usernameField.elementId')).focus();
    },

    initLoginSpinner: function() {
        var spinner = Ladda.create($('#login-form-cmp-login-btn')[0]);

        this.addObserver('isProcessing', this, function() {
            if (this.get('isProcessing')) {
                spinner.start();
            } else {
                spinner.stop();
            }
        });
    },

    onLoginSuccess: function(data) {
        this.sendAction('authenticated', data.user);

        if (data.migrated) {
            App.showAccountNotification('We\'ve migrated data from your Guest session.', true);
        }

        this.setProperties({
            loginFailed: false,
            isProcessing: false
        });
    },

    onLoginFail: function(xhr) {
        var error;
        if (xhr.responseText) {
            try {
                error = JSON.parse(xhr.responseText).message;
            } catch (e) {
                error = 'Error: ' + xhr.responseText;
            }
        } else {
            error = 'Unexpected error: ' + xhr.statusText;
        }

        this.setProperties({
            loginFailed: true,
            isProcessing: false,
            loginErrorMessage: error
        });
    }
});
