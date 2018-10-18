App.ResetPasswordController = Ember.Controller.extend({
    actionFailed: false,
    isProcessing: false,
    errorMessage: '',

    actions: {
        resetPassword: function(data) {
            data.passResetHash  = this.model.get('hash');
            data.action         = 'reset-password';

            this.setProperties({ isProcessing: true });
            var request = $.post('/api/v1.0/connection', data);
            request.done(_.bind(this.onPasswordReset, this));
            request.fail(_.bind(this.onRequestFailed, this));
            request.always(_.bind(function(){
                this.setProperties({ isProcessing: false });
            }, this));

        }
    },

    onPasswordReset: function(response){
        this.transitionToRoute('password-reset-success');
    },

    onRequestFailed: function(jqXHR, textStatus, errorThrown){
        this.setProperties({actionFailed: true, errorMessage: jqXHR.responseJSON.message});
    }
});
