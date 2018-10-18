/*global Ladda*/
App.ResetPasswordView = Ember.View.extend({
    password: '',

    didInsertElement: function() {
        this.initFormValidation();
        this.initSpinner();
    },

    initSpinner: function() {
        var spinner = Ladda.create($('#reset-pwd-btn')[0]);

        this.addObserver('controller.isProcessing', this, function() {
            if (this.get('controller.isProcessing')) {
                spinner.start();
            } else {
                spinner.stop();
            }
        });
    },

    initFormValidation: function() {
        $('#reset-password-form').validate({
            rules: {
                password: {
                    required: true,
                    minlength: 6
                },
                confirmPassword: {
                    required: true,
                    equalTo: "#password"
                }
            },

            highlight: function(label) {
                $(label).closest('.form-group').addClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').removeClass('hidden');
            },
            unhighlight: function(label) {
                $(label).closest('.form-group').removeClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').addClass('hidden');
            },
            errorPlacement: function(error, element) {
                $(element).closest('.form-group').find('.form-control-feedback').tooltip().prop('title', $(error).text());
            },

            submitHandler: _.bind(function() {
                this.get('controller').send('resetPassword', {
                    password: this.get('password')
                });
            }, this)
        });
    }
});
