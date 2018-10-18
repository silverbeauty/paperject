window.PaperjetApplication = Ember.Application.extend(Ember.Evented, {
    clientId: '',

    CONFIRM_EMAIL_MESSAGE: 'Please confirm your email. Did not receive a message? _send_email_confirmation_',

    paperjetBrandHost: function() {
        return $('meta[name="paperjet-brand-host"]').attr('content');
    }.property(),

    enableFfd: function() {
        return !$('body').hasClass('allangray');
    }.property(),

    onClientIdChange: function() {
        $.ajaxSetup({
            headers: {
                ClientID: this.get('clientId')
            }
        });
    }.observes('clientId'),

    clearNotificationMessage: function() {
        this.trigger('clear-message');
    },

    // trigger event and ensure that it was consumed
    triggerCheckedEvent: function(name, args, timeout) {
        args.checked = false;
        this.trigger(name, args);

        if (!args.checked) {
            timeout = Math.min((timeout || 100) * 2, 2000); // increase timeout
            setTimeout(_.bind(this.triggerCheckedEvent, this, name, args, timeout), timeout);
        }
    },

    showError: function(message) {
        this.triggerCheckedEvent('display-message', {
            type: 'error',
            message: message
        });
    },

    showNotification: function(message, autoDismiss) {
        this.triggerCheckedEvent('display-message', {
            type: 'notification',
            message: message,
            autoDismiss: autoDismiss
        });
    },

    showAccountNotification: function(message) {
        this.triggerCheckedEvent('account-message', {
            message: message
        });
    },

    showProgress: function(message, percentsCompleted) {
        this.trigger('display-message', {
            type: 'progress',
            message: message,
            percentsCompleted: Math.round((percentsCompleted || 0) / 10) * 10 // round to 10%
        });
    },

    isNotMobileDevice: function() {
        return !(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()));
    }.property(),

    checkProducthunt: function(store) {
        if (window.clientStorage.readValue('producthunt')) {
            window.clientStorage.removeValue('producthunt');

            var producthuntSuccess = _.bind(function(data) {
                App.showAccountNotification('We\'ve activated your free PRO account.');

                store.pushPayload('user', {
                    users: [data.user]
                });
            }, this);

            $.ajax({
                url: '/api/v1.0/producthunt',
                type: 'POST',
                contentType: 'application/json',
                cache: false,
                dataType: 'json',
                context: this,
                processData: false, // Don't process the files
                success: producthuntSuccess,
                error: _.bind(function(xhr, textStatus, errorThrown) {
                    if (xhr.status === 200) {
                        producthuntSuccess(JSON.parse(xhr.responseText));
                    } else {
                        App.showError('Failed to activate your free PRO account. Please contact support@paperjet.com');
                    }
                }, this)
            });
        }
    },

    checkBrowser: function() {
        if (this.get('isNotMobileDevice')) {
            var version = (function() {
                var ua = navigator.userAgent,
                    tem,
                    M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];

                if (/trident/i.test(M[1])) {
                    tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
                    return 'IE ' + (tem[1] || '');
                }

                if (M[1] === 'Chrome') {
                    tem = ua.match(/\bOPR\/(\d+)/);

                    if (tem != null) {
                        return 'Opera ' + tem[1];
                    }
                }

                M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];

                if ((tem = ua.match(/version\/(\d+)/i)) != null) {
                    M.splice(1, 1, tem[1]);
                }

                return M.join(' ');
            })();

            if (version) {
                version = version.split(' ');

                var versionNumber = parseInt(version[1], 10),
                    oldBrowser = false;

                if (!isNaN(versionNumber)) {
                    switch (version[0]) {
                        // TODO: android browser has limited support too.
                        case 'MSIE':
                            if (versionNumber < 10) {
                                oldBrowser = true;
                            }
                            break;
                        case 'Safari':
                            if (versionNumber <= 8) {
                                oldBrowser = true;
                            }
                            break;
                    }

                    if (oldBrowser) {
                        setTimeout(_.bind(function() {
                            this.showAccountNotification('<i class="fa fa-exclamation-triangle" style="color: orange;"></i> Your browser has limited support working with PDFs online. Please consider latest version, or try Chrome.');
                        }, this), 1000);
                    }
                }
            }
        }
    }
});
