'use strict';

/*global Ladda*/
App.DocEmailComponent = Ember.Component.extend({
    from: '',
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    message: '',
    pages: null,
    user: null,
    doc: null,
    submitSpinner: null,
    pdfExportService: null, // injected by the app
    showEmailFields: false,
    visible: false,

    emailInvalid: false,
    passwordInvalid: false,
    sendDisabled: Ember.computed.or('emailInvalid', 'passwordInvalid'),

    encryptPDF: false,
    password: '',
    passwordConfirm: '',

    actions: {
        enableEmailFields: function() {
            this.set('showEmailFields', true);
        },

        submitEmail: function() {
            this.set('errorMessage', '');
            this.submitSpinner.start();
            this.pdfExportService.exportPages(this.doc, this.pages, this.sendEmail, this);
        }
    },

    resetFields: function() {
        if (this.visible) {
            this.setProperties({
                showEmailFields: false,
                to: this.get('user.email'),
                from: this.get('user.email'),
                cc: '',
                bcc: '',
                subject: this.get('doc.name'),
                message: '',
                encryptPDF: false,
                password: '',
                passwordConfirm: ''
            });
        }
    }.observes('visible'),

    initSubject: function() {
        this.set('subject', this.get('doc.name'));
    }.observes('doc.name'),

    didInsertElement: function() {
        this.set('submitSpinner', Ladda.create(this.$('.btn-send')[0]));

        $('textarea.js-auto-size').textareaAutoSize();

        var validateEmail = _.bind(function(validator) {
            validator.checkForm();
            this.set('emailInvalid', !validator.valid());
        }, this);

        // init form validation plugin
        this.$('.js-email-form').validate({
            rules: {
                from: {
                    required: true,
                    email: true
                },
                to: {
                    required: true,
                    email: true
                },
                subject: {
                    required: true
                },
                cc: {
                    email: true
                },
                bcc: {
                    email: true
                }
            },

            highlight: function(label) {
                validateEmail(this);
                $(label).closest('.form-group').addClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').removeClass('hidden');
            },

            unhighlight: function(label) {
                validateEmail(this);
                $(label).closest('.form-group').removeClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').addClass('hidden');
            },

            errorPlacement: function(error, element) {
                $(element).closest('.form-group').find('.form-control-feedback').tooltip().prop('title', $(error).text());
            }
        });
    },

    initPasswordValidation: function() {
        if (this.get('encryptPDF')) {
            Ember.run.scheduleOnce('afterRender', this, function() {
                var validatePassword = _.bind(function(validator) {
                    validator.checkForm();
                    this.set('passwordInvalid', !validator.valid());
                }, this);

                this.$('.js-email-password-form').validate({
                    rules: {
                        password: {
                            required: true,
                            simplifiedPassword: true,
                            minlength: 6
                        },
                        passwordConfirm: {
                            required: true,
                            equalTo: '#' + this.get('passwordField.elementId')
                        }
                    },

                    highlight: function(label) {
                        validatePassword(this);
                        $(label).closest('.form-group').addClass('has-error');
                        $(label).closest('.form-group').find('.form-control-feedback').removeClass('hidden');
                    },

                    unhighlight: function(label) {
                        validatePassword(this);
                        $(label).closest('.form-group').removeClass('has-error');
                        $(label).closest('.form-group').find('.form-control-feedback').addClass('hidden');
                    },

                    errorPlacement: function(error, element) {
                        $(element).closest('.form-group').find('.form-control-feedback').tooltip().prop('title', $(error).text());
                    }
                });
            });
        }
    }.observes('encryptPDF'),

    sendEmail: function(pdf) {
        var email = this.getProperties('from', 'to', 'cc', 'bcc', 'subject', 'message');

        if (this.get('encryptPDF') && this.get('password').trim().length) {
            email.password = this.get('password').trim();
        }

        $.ajax({
            url: sprintf('/api/v1.0/users/%s/documents/%s', App.get('userId'), this.get('doc.id')),
            type: 'POST',
            data: JSON.stringify({
                action: 'email',
                email: email,
                pdf: pdf
            }),
            contentType: 'application/json',
            cache: false,
            dataType: 'json',
            context: this,
            processData: false, // Don't process the files
            success: this.onEmailSent,
            error: function(xhr, textStatus, errorThrown) {
                if (xhr.status === 200) {
                    this.onEmailSent();
                } else {
                    var message = 'Failed to email document';

                    if (xhr.responseText) {
                        try {
                            message = JSON.parse(xhr.responseText).message;
                        } catch (e) {}
                    }

                    this.set('errorMessage', message);
                    this.submitSpinner.stop();
                }
            }
        });
    },

    onEmailSent: function() {
        this.sendAction('emailSent');
        this.submitSpinner.stop();

        var recipients = [];

        if (this.get('to')) {
            recipients.push(this.get('to'));
        }

        if (this.get('cc')) {
            recipients.push(this.get('cc'));
        }

        if (this.get('bcc')) {
            recipients.push(this.get('bcc'));
        }

        App.showNotification('We\'re sending your email to ' + recipients.join(', ') + '.', true);
    }
});
