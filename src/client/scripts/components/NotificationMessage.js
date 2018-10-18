'use strict';

/*global Handlebars*/

App.NotificationMessageComponent = Ember.Component.extend({
    message: '',
    messageType: 'notification',
    messageTimerId: 0,
    percentsCompleted: null,
    progressBarStyle: '',
    accountNotificationQueue: [],
    accountNotificationVisible: false,

    actions: {
        dismissErrorMessage: function() {
            this.set('message', '');
        }
    },

    isErrorMessage: function() {
        return this.get('messageType') === 'error';
    }.property('messageType'),

    init: function() {
        this._super();

        App.on('account-message', this, this.onAccountMessage);
        App.on('display-message', this, this.onDisplayMessage);
        App.on('clear-message', this, this.onClearMessage);
    },

    showNextAccountNotification: function() {
        if (!this.accountNotificationVisible && this.accountNotificationQueue.length) {
            var el = $('.btn-profile'),
                timer;

            el.popover({
                html: true,
                content: '<div class="account-message">' + this.accountNotificationQueue[0] + '</div>',
                placement: 'bottom'
            });

            this.accountNotificationVisible = true;
            this.accountNotificationQueue.splice(0, 1);

            timer = setTimeout(function() {
                el.popover('hide');
            }, 5000);

            el.one('hidden.bs.popover', _.bind(function() {
                el.popover('destroy');
                clearTimeout(timer);

                setTimeout(_.bind(function() {
                    this.accountNotificationVisible = false;
                    this.showNextAccountNotification();
                }, this), 200);
            }, this));

            el.popover('show');
        }
    },

    onAccountMessage: function(data) {
        data.checked = true;
        this.accountNotificationQueue.push(data.message);
        Ember.run.later(this, this.showNextAccountNotification, 200); // delay is needed, because header is re-aligned on login
    },

    willDestroyElement: function() {
        //the component is using on different pages, so we have to unbind events before new page is displayed
        App.off('display-message', this, this.onDisplayMessage);
        App.off('clear-message', this, this.onClearMessage);
    },

    onDisplayMessage: function(data) {
        data.checked = true;

        clearTimeout(this.get('messageTimerId'));

        if (data.message) {
            if (data.message.indexOf('_invite_more_friends_') !== -1) {
                data.message = data.message.replace('_invite_more_friends_', '<a class="js-invite-more-friends" href="#">invite more friends</a>');

                data.message = new Handlebars.SafeString(data.message.replace('_go_pro_', '<a class="js-go-pro" href="#">go Pro</a>'));
            } else if (data.message.indexOf('_send_email_confirmation_') !== -1) {
                data.message = new Handlebars.SafeString(data.message.replace('_send_email_confirmation_', '<a class="js-send-email-confirmation" href="#">Send email again</a>'));
            }
        }

        this.set('message', data.message);
        this.set('messageType', data.type || 'notification');
        this.set('percentsCompleted', data.percentsCompleted || null);
        if (this.get('percentsCompleted')) {
            this.set('progressBarStyle', ('width: ' + parseInt(this.get('percentsCompleted'), 10) + '%').htmlSafe());
        }

        if (data.autoDismiss) {
            var timerId = setTimeout(_.bind(function() {
                this.set('message', '');
            }, this), 5000);

            this.set('messageTimerId', timerId);
        }
    },

    onClearMessage: function() {
        this.set('message', '');
    },

    didInsertElement: function() {
        $('body').on('click', '.js-invite-more-friends', function(e) {
            $('#referrals-modal').modal('show');

            setTimeout(function() {
                var ref = $('#refferal-link');

                if (ref.length) {
                    ref.focus();
                    ref[0].setSelectionRange(0, 9999);
                }
            }, 1000);

            e.preventDefault();
            e.stopPropagation();
        });

        $('body').on('click', '.js-go-pro', function(e) {
            $('#subscription-modal').modal('show');
            e.preventDefault();
            e.stopPropagation();
        });

        $('body').on('click', '.js-send-email-confirmation', function(e) {
            $.post('/api/v1.0/connection', {
                action: 'send-confirmation-email'
            }).done(function() {
                App.showNotification('We\'ve sent confirmation email');
            }).fail(function() {
                App.showError('Failed to sent confirmation email');
            });
        });
    }
});
