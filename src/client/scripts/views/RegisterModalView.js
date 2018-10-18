'use strict';

/*global App, Ember */
App.RegisterModalView = Ember.View.extend({ // TODO: convert to component
    tagName: '',
    templateName: 'views/register-modal',
    dismissAnonymousAccountError: '',

    actions: {
        dismissAnonymousAccount: function() {
                this.set('dismissAnonymousAccountError', '');

                $.ajax({
                    url: sprintf('/api/v1.0/users/%s', this.get('controller.controllers.application.model.profile.id')),
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        action: 'deactivateAnonymous'
                    },
                    success: function(response) {
                        location.href = "/dashboard/";
                    },
                    error: _.bind(function(xhr) {
                        var error;
                        if (xhr.responseJSON && ('message' in xhr.responseJSON)) {
                            error = xhr.responseJSON.message;
                        } else {
                            error = xhr.responseText;
                        }

                        this.set('dismissAnonymousAccountError', error || 'Failed to close your account.');
                    }, this)
                });
            }
            //    showLoginModal: function() {
            //        $('#register-modal').on('hidden.bs.modal', function() {
            //            $('#register-modal').off();
            //            $('#login-modal').modal('show');
            //        });
            //        $('#register-modal').modal('hide');
            //    }
    },

    didInsertElement: function() {
        $('#register-modal').on('shown.bs.modal', function() {
            $(this).find('[name=email]').focus();
        });
    }
});
