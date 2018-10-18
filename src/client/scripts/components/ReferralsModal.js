'use strict';

/*global App, Ember, $, _, Ladda, sprintf*/
App.ReferralsModalComponent = Ember.Component.extend({
    isInviteBtnDisabled: true,
    isInvitesSendingInProgress: false,
    errorAlert: '',
    profile: null,

    actions: {
        inviteByEmail: function() {
            this.set('isInvitesSendingInProgress', true);
            var emails = $('#profile-invite-emails').tagsinput('items');
            if (emails.length) {
                $.ajax({
                    url: sprintf('/api/v1.0/users/%s/invite', App.get('userId')),
                    data: {
                        emails: emails
                    },
                    dataType: 'json',
                    type: 'post',
                    success: _.bind(function() {
                        $('#invites-sent-modal').modal('show');
                        this.set('isInviteBtnDisabled', true);
                        $('#profile-invite-emails').tagsinput('removeAll');
                    }, this),
                    error: _.bind(function() {
                        this.setProperties({
                            errorAlert: 'Server error'
                        });
                    }, this),
                    complete: _.bind(function() {
                        this.set('isInvitesSendingInProgress', false);
                    }, this)
                });
            }
        },

        hideReferralsModal: function() {
            $('#referrals-modal').modal('hide');
        }
    },

    didInsertElement: function() {
        this._super();

        $('#referrals-modal').on('show.bs.modal', _.bind(this.beforeShow, this));
        $('#refferal-link').on('click', function() {
            $(this)[0].setSelectionRange(0, 9999);
        });

        this.initializeEmailsTagsinput();
    },

    beforeShow: function() {
        this.set('errorAlert', '');
    },

    onIsInvitesSendingInProgressChanged: function() {
        var spinner = this.get('inviteSpinner');
        if (spinner && this.get('isInvitesSendingInProgress')) {
            spinner.start();
        } else {
            spinner.stop();
        }
    }.observes('isInvitesSendingInProgress'),

    initializeEmailsTagsinput: function() {
        var enterKeypressEvent = jQuery.Event('keypress'),
            ENTER_KEY_CODE = 13,
            isEmail = function(testedText) {
                var emailRegex = new RegExp(/^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i);
                return emailRegex.test(testedText);
            };
        enterKeypressEvent.which = ENTER_KEY_CODE;


        $('#profile-invite-emails').tagsinput({
            // enter, comma and whitespace
            confirmKeys: [13, 44, 32, 9],
            trimValue: true
        });

        // prevent input from loosing focus on TAB press and force it to act like the rest 'confirmKeys'
        $('.bootstrap-tagsinput input').on('keydown', function(e) {
            var keyCode = e.keyCode || e.which,
                TAB_KEY_CODE = 9;

            if (keyCode == TAB_KEY_CODE) {
                e.preventDefault();
                // trigger keypress event to append email to the tags list
                $(this).trigger(enterKeypressEvent);
            }
        }).on('paste', function() {
            // Delay event processing since the paste event fires before text is inserted into the textfield
            Ember.run.later(this, function() {
                var pastedString = $(this).val(),
                    emails = pastedString.split(/[\s,;]+/),
                    incorrectEmails = [];
                _.each(emails, function(email) {
                    if (isEmail(email)) {
                        $('#profile-invite-emails').tagsinput('add', email);
                    } else {
                        // user may want to fix emails that have incorrect format, so they should be displayed in the input
                        incorrectEmails.push(email);
                    }
                });
                $(this).val(incorrectEmails.join(', '));
            }, 100);
        });

        $('#profile-invite-emails').on('beforeItemAdd', function(event) {
            if (!isEmail(event.item)) {
                event.cancel = true;
            }
        }).on('itemAdded', _.bind(function(event) {
            this.set('isInviteBtnDisabled', false);
        }, this)).on('itemRemoved', _.bind(function() {
            if ($('#profile-invite-emails').tagsinput('items').length === 0) {
                this.set('isInviteBtnDisabled', true);
            }
        }, this));

        if ($('#invite-by-email-btn').length) { // not defined for anonymous users
            this.set('inviteSpinner', Ladda.create($('#invite-by-email-btn')[0]));
        }
    },

    inviteLink: function() {
        return sprintf('%s//%s/dashboard/register?inviteId=%s', window.location.protocol, window.location.host,
            this.get('profile.inviteId'));
    }.property('profile.inviteId')
});
