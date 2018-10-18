'use strict';

/*global App, Ember, $*/
App.RegistrationFormComponent = Ember.Component.extend({
    registrationFailed: false,
    isDuplicatedEmail: false,
    errorMessage: '',
    inviteId: '',
    email: '',
    password: '',

    didInsertElement: function() {
        $('#' + this.get('emailField.elementId')).focus();

        this.$('form').validate({
            rules: {
                email: {
                    required: true,
                    email: true
                },
                password: {
                    required: true,
                    minlength: 6
                },
                confirmPassword: {
                    required: true,
                    equalTo: '#' + this.get('passwordField.elementId')
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
                this.setProperties({
                    registrationFailed: false,
                    isDuplicatedEmail: false,
                    errorMessage: ''
                });

                this.sendAction('action', {
                    action: 'setIsProcessingStatus',
                    isProcessing: true
                });

                $.ajax({
                    url: '/api/v1.0/connection',
                    dataType: 'json',
                    contentType: 'application/json',
                    processData: false, // Don't process the files
                    type: 'POST',
                    data: JSON.stringify({
                        action: 'register',
                        email: this.get('email'),
                        password: this.get('password'),
                        inviteId: this.get('inviteId')
                    }),
                    context: this,
                    success: function(data) {
                        this.setProperties({
                            registrationFailed: false
                        });

                        data.id = data._id;

                        this.sendAction('action', {
                            action: 'regDone',
                            user: data
                        });
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        if (jqXHR.responseJSON && jqXHR.responseJSON.code) {
                            if (jqXHR.responseJSON.code == 'duplicated_email') {
                                this.setProperties({
                                    isDuplicatedEmail: true
                                });
                            } else {
                                this.setProperties({
                                    registrationFailed: true,
                                    errorMessage: jqXHR.responseJSON.code
                                });
                            }
                        } else if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
                            this.setProperties({
                                registrationFailed: true,
                                errorMessage: jqXHR.responseJSON.message
                            });
                        }
                    },
                    complete: function() {
                        this.sendAction('action', {
                            action: 'setIsProcessingStatus',
                            isProcessing: false
                        });
                    }
                });
            }, this)
        });
    }
});
