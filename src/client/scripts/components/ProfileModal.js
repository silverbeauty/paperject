'use strict';

/*global App, Ember, $, _, Ladda, sprintf*/
App.ProfileModalComponent = Ember.Component.extend({
    saveProfileSpinner: null,
    isProfileEditing: false,
    isPasswordEditing: false,
    isProfileEditingCancelled: false,
    isProfileUpdating: false,
    profileErrorMessage: '',
    passChangeMessage: '',
    accCancelMessage: '',
    isAccCancelError: false,
    showAccDeactivateConfirmation: false,
    emailInvalid: false,

    initialEmail: '',
    initialFirstName: '',
    initialLastName: '',

    isProfileUpdatingOrEmailInvalid: Ember.computed.or('emailInvalid', 'isProfileUpdating'),

    actions: {
        hideProfileModal: function() {
            $('#profile-modal').modal('hide');
        },

        enableProfileEditMode: function() {
            this.setProperties({
                initialEmail: this.get('profile.email'),
                initialFirstName: this.get('profile.firstName'),
                initialLastName: this.get('profile.lastName'),
                isProfileEditing: true
            });
        },

        disableProfileEditMode: function() {
            this.setProperties({
                isProfileEditing: false,
                isProfileEditingCancelled: true,
                profileErrorMessage: '',
                'profile.email': this.get('initialEmail'),
                'profile.firstName': this.get('initialFirstName'),
                'profile.lastName': this.get('initialLastName')
            });
        },

        saveProfile: function() {
            var profile = this.get('profile');

            if (profile.get('isDirty')) {
                this.setProperties({
                    isProfileUpdating: true,
                    profileErrorMessage: ''
                });

                profile.save()
                    .then(_.bind(function() {
                        this.setProperties({
                            isProfileEditing: false,
                            isProfileEditingCancelled: false,
                            isProfileUpdating: false
                        });

                        profile.setProperties({
                            isPassworSet: true
                        });
                    }, this))
                    .catch(_.bind(function(why) {
                        var error;
                        if (why.responseText) {
                            try {
                                error = JSON.parse(why.responseText).message;
                            } catch (e) {
                                error = 'Error: ' + why.responseText;
                            }
                        } else {
                            error = 'Unexpected error';
                        }
                        this.setProperties({
                            isProfileUpdating: false,
                            profileErrorMessage: error,
                            isError: true
                        });
                    }, this));
            }
        },

        enablePasswordEditMode: function() {
            this.set('isPasswordEditing', true);
        },

        disablePasswordEditMode: function() {
            this.set('isPasswordEditing', false);
        },

        setAccDeactivationConfirm: function(val) {
            this.set('showAccDeactivateConfirmation', val);
        },

        deactivateAccount: function() {
            this.set('accCancelMessage', '');
            $.ajax({
                url: sprintf('/api/v1.0/users/%s', this.get('profile.id')),
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'deactivate'
                },
                success: function(response) {
                    location.href = "/";
                },
                error: _.bind(function(xhr) {
                    var error;
                    if (xhr.responseJSON && ('message' in xhr.responseJSON)) {
                        error = xhr.responseJSON.message;
                    } else {
                        error = xhr.responseText;
                    }
                    this.setProperties({
                        accCancelMessage: error,
                        isAccCancelError: true
                    });
                }, this)
            });
        },

        refreshSubscription: function() {
            var loading = Ladda.create($('#profile-modal-refresh-subscription')[0]);
            loading.start();

            $.ajax({
                url: sprintf('/api/v1.0/users/%s/subscription', this.get('profile.id')),
                type: 'POST',
                dataType: 'json',
                data: {
                    action: 'checkSubscription'
                },
                context: this,
                success: function(response) {
                    var rec = this.get('profile');

                    if (rec.get('isDirty')) {
                        var onSave = function() {
                            rec.reload();
                            rec.off('didUpdate', onSave);
                            loading.stop();
                        };

                        rec.on('didUpdate', onSave);
                    } else {
                        rec.reload();
                        loading.stop();
                    }
                },
                error: _.bind(function(xhr) {
                    loading.stop();
                    var error;
                    if (xhr.responseJSON && ('message' in xhr.responseJSON)) {
                        error = xhr.responseJSON.message;
                    } else {
                        error = xhr.responseText;
                    }

                    $('#profile-modal').modal('hide');
                    App.showError("Failed to refresh subscription information. Please concact support@paperjet.com", true);
                }, this)
            });
        },

        sendConfirmationEmail: function() {
            var loading = Ladda.create($('.js-send-confirmation-email')[0]);
            loading.start();

            $.post('/api/v1.0/connection', {
                action: 'send-confirmation-email'
            }).done(_.bind(function() {
                App.showNotification('We\'ve sent confirmation email to ' + this.get('profile.email'));
            }, this)).fail(function() {
                App.showError('Failed to sent confirmation email');
            }).always(function() {
                loading.stop();
                $('#profile-modal').modal('hide');
            });
        }
    },

    hasSubscription: function() {
        var type = this.get('profile.subscription.type');
        return type === 'annual' || type === 'monthly';
    }.property('profile.subscription.type'),

    showCheckSubscription: function() {
        var paidUntil = this.get('profile.paidUntil');
        return paidUntil ? paidUntil.getTime() < Date.now() : false;
    }.property('profile.paidUntil'),

    didInsertElement: function() {
        this._super();

        $('#profile-modal').on('show.bs.modal', _.bind(function() {
            this.setProperties({
                showAccDeactivateConfirmation: false,
                isProfileEditing: false,
                isPasswordEditing: false
            });
        }, this));
    },

    renewInterval: function() {
        switch (this.get('profile.subscription.type')) {
            case 'annual':
                return 'yearly';
            case 'monthly':
                return 'monthly';
        }

        return '';
    }.property('profile.subscription.type'),

    maxUploadGB: function() {
        return (this.get('profile.metrics.storageLimit') / (1024 * 1024 * 1024)).toFixed(1);
    }.property('profile.metrics'),

    // May be required in the future
    //maxBandwidhtGB: function() {
    //    return this.get('profile.subscription') ? 10 : 2;
    //}.property('profile.subscription'),

    initPassFormValidation: function() {
        $('#change-password-form').validate({
            rules: {
                oldPassword: {
                    required: true,
                    minlength: 6
                },
                newPassword: {
                    required: true,
                    minlength: 6
                },
                confirmNewPassword: {
                    required: true,
                    equalTo: "#newPassword"
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

            submitHandler: _.bind(this.changePassword, this)
        });
    },

    initProfileFormValidation: function() {
        $('#profile-email-form').validate({
            rules: {
                email: {
                    required: true,
                    email: true
                }
            },

            highlight: _.bind(function(label) {
                $(label).closest('.form-group').addClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').removeClass('hidden');
                this.set('emailInvalid', true);
            }, this),
            unhighlight: _.bind(function(label) {
                $(label).closest('.form-group').removeClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').addClass('hidden');
                this.set('emailInvalid', false);
            }, this),
            errorPlacement: function(error, element) {
                $(element).closest('.form-group').find('.form-control-feedback').tooltip().prop('title', $(error).text());
            }
        });
    },


    changePassword: function() {
        this.set('passChangeMessage', '');

        var data = this.getProperties('oldPassword', 'newPassword', 'confirmNewPassword');
        data.action = 'change-password';

        this.setProperties({
            isPasswordUpdating: true
        });
        var request = $.post('/api/v1.0/connection', data);
        request.done(_.bind(this.onPasswordChanged, this));
        request.fail(_.bind(this.onRequestFailed, this));
        request.always(_.bind(function() {
            this.setProperties({
                isPasswordUpdating: false
            });
        }, this));
    },

    onIsProfileEditingChanged: function() {
        if (this.get('isProfileEditing')) {
            // spinner must be re-initialized each time when the form is shown because form re-rendering
            // creates new DOM elements
            Ember.run.scheduleOnce('afterRender', this, function() {
                this.set('saveProfileSpinner', Ladda.create($('#save-profile-btn')[0]));
            });
        }
    }.observes('isProfileEditing'),

    onIsProfileUpdatingChanged: function() {
        var spinner = this.get('saveProfileSpinner');
        if (this.get('isProfileUpdating')) {
            spinner.start();
        } else {
            spinner.stop();
        }
    }.observes('isProfileUpdating'),

    onPasswordChanged: function(response) {
        this.setProperties({
            passChangeMessage: 'Password has been changed',
            isPassError: false
        });

        //reset form
        this.setProperties({
            'oldPassword': '',
            newPassword: '',
            confirmNewPassword: ''
        });
    },

    onRequestFailed: function(jqXHR, textStatus, errorThrown) {
        this.setProperties({
            passChangeMessage: jqXHR.responseJSON.message,
            isPassError: true
        });
    },

    isPasswordEditingObserver: function() {
        if (this.get('isPasswordEditing')) {
            // Form's DOM is created each time when form is rendered, so validation must be initialized on each form render
            Ember.run.scheduleOnce('afterRender', this, function() {
                this.initPassFormValidation();
            });
        }
    }.observes('isPasswordEditing'),

    isProfileEditingObserver: function() {
        if (this.get('isProfileEditing')) {
            // Form's DOM is created each time when form is rendered, so validation must be initialized on each form render
            Ember.run.scheduleOnce('afterRender', this, function() {
                this.initProfileFormValidation();
            });
        }
    }.observes('isProfileEditing')
});
