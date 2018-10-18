'use strict';

/*global StripeCheckout*/
App.SubscriptionModalComponent = Ember.Component.extend({
    subscription: null,
    errorMessage: '',
    email: '',
    stripeHandler: null,
    amount: 0,
    newSubscription: '',
    paidUntil: null,

    isMonthlyBtnActive: true,
    isAnnualBtnActive: false,
    proSubscriptionMonthlyPrice: 0,
    // businessSubscriptionMonthlyPrice: 0,

    proSubscriptionAnnualPrice: 0,
    // businessSubscriptionAnnualPrice: 0,
    subscriptionPackage: '',
    freeUploadsQuota: 0,

    isSubscribedToPro: Ember.computed.equal('subscription.package', 'pro'),
    // isSubscribedToBusiness: Ember.computed.equal('subscription.package', 'business'),

    actions: {
        hideSubscriptionModal: function() {
            $('#subscription-modal').modal('hide');
        },

        dismissErrorMessage: function() {
            this.set('errorMessage', '');
        },

        cancelSubscription: function() {
            this.set('errorMessage', '');
            this.mask();

            $.ajax({
                url: sprintf('/api/v1.0/users/%s/subscription', App.get('userId')),
                type: 'DELETE',
                cache: false,
                processData: false, // Don't process the files
                success: _.bind(function(data) {
                    this.notifyProfileUpdate(data.user);
                    this.unmask();
                    this.accountNotification('Your subscription was cancelled');
                    $('#subscription-modal').modal('hide');
                }, this),
                error: _.bind(function(xhr, textStatus, errorThrown) {
                    var message = (xhr.responseJSON && xhr.responseJSON.message) ? ('Error: ' + xhr.responseJSON.message) : 'Unknown error';
                    this.set('errorMessage', message);
                    this.unmask();
                }, this)
            });
        },

        proSubscription: function() {
            this.set('subscriptionPackage', 'pro');
            if (this.get('isMonthlyBtnActive')) {
                this.createSubscription('monthly');
            } else if (this.get('isAnnualBtnActive')) {
                this.createSubscription('annual');
            }
        },

        // businessSubscription: function() {
        //     this.set('subscriptionPackage', 'business');
        //     if (this.get('isMonthlyBtnActive')) {
        //         this.createBusinessSubscription('monthly');
        //     } else if (this.get('isAnnualBtnActive')) {
        //         this.createBusinessSubscription('annual');
        //     }
        // },

        faxPayment5: function() {
            this.makeOneTimePayment(5);
        },

        faxPayment10: function() {
            this.makeOneTimePayment(10);
        },

        toggleToMonthly: function() {
            this.setProperties({
                isMonthlyBtnActive: true,
                isAnnualBtnActive: false
            });
        },

        toggleToAnnual: function() {
            this.setProperties({
                isMonthlyBtnActive: false,
                isAnnualBtnActive: true
            });
        }
    },

    init: function() {
        this._super();

        this.setProperties({
            proSubscriptionMonthlyPrice: parseInt($('meta[name="pricing-pro-monthly"]').attr('content'), 10),
            // businessSubscriptionMonthlyPrice: parseInt($('meta[name="pricing-business-monthly"]').attr('content'), 10),

            proSubscriptionAnnualPrice: parseInt($('meta[name="pricing-pro-annual"]').attr('content'), 10),
            // businessSubscriptionAnnualPrice: parseInt($('meta[name="pricing-business-annual"]').attr('content'), 10),

            freeUploadsQuota: parseInt($('meta[name="free-uploads-quota"]').attr('content'), 10)
        });
    },

    mask: function() {
        $('body').append('<div class="loading-container" id="payment-mask"><i class="fa fa-spin fa-refresh"></i></div>');
    },

    unmask: function() {
        $('#payment-mask').remove();
    },

    accountNotification: function(message) {
        $('.btn-profile').popover('destroy');

        var notification = $('.btn-profile').popover({
            html: true,
            content: '<div style="white-space: nowrap">' + message + '</div>',
            placement: 'bottom'
        });

        notification.popover('show');

        setTimeout(function() {
            notification.popover('destroy');
        }, 5000);
    },

    initStripeHandler: function(callback) {
        this.set('errorMessage', '');

        if (!this.get('stripeHandler')) {
            $.getScript('https://checkout.stripe.com/checkout.js', _.bind(function() {
                this.set('stripeHandler', StripeCheckout.configure({
                    key: $('meta[name="stripe-public-key"]').attr('content'),
                    image: '/images/stripe-logo.png',
                    name: 'Paperjet',
                    allowRememberMe: false,
                    email: this.get('email'),
                    opened: _.bind(function() {
                        $('#subscription-modal').modal('hide');
                    }, this),
                    token: _.bind(this.submitPayment, this)
                }));

                callback.call(this);
            }, this));
        } else {
            callback.call(this);
        }
    },

    submitPayment: function(token) {
        this.mask();

        var data;

        if (this.get('newSubscription')) {
            data = {
                token: token.id,
                amount: this.get('amount'),
                subscription: this.get('newSubscription'),
                subscriptionPackage: this.get('subscriptionPackage')
            };
        } else {
            data = {
                token: token.id,
                amount: this.get('amount'),
                type: 'fax'
            };
        }

        $.ajax({
            url: sprintf(this.get('newSubscription') ? '/api/v1.0/users/%s/subscription' : '/api/v1.0/users/%s/payment', App.get('userId')),
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            cache: false,
            dataType: 'json',
            processData: false, // Don't process the files
            success: _.bind(function(data) {
                this.notifyProfileUpdate(data.user);
                this.unmask();
                this.accountNotification(this.get('newSubscription') ? 'Your account was upgraded' : 'Your payment was successful');
            }, this),
            error: _.bind(function(xhr, textStatus, errorThrown) {
                var message = (xhr.responseJSON && xhr.responseJSON.message) ? ('Error: ' + xhr.responseJSON.message) : 'Unknown payment error';
                this.set('errorMessage', message);
                $('#subscription-modal').modal('show');
                this.unmask();
            }, this)
        });
    },

    notifyProfileUpdate: function(user) {
        this.sendAction('profileUpdate', user);
    },

    // FIX: merge with createBusinessSubscription
    createSubscription: function(subscription) {
        this.initStripeHandler(function() {
            var amount = subscription === 'monthly' ? this.get('proSubscriptionMonthlyPrice') : this.get('proSubscriptionAnnualPrice');
            this.set('amount', amount * 100);
            this.set('newSubscription', subscription);

            this.get('stripeHandler').open({
                panelLabel: 'Subscribe',
                description: sprintf('Pro Subscription, $%s/%s', amount, this.get('newSubscription') === 'monthly' ? 'Month' : 'Year')
            });
        });
    },

    // createBusinessSubscription: function(subscription) {
    //     this.initStripeHandler(function() {
    //         var amount = (subscription === 'monthly') ? this.get('businessSubscriptionMonthlyPrice') : this.get('businessSubscriptionAnnualPrice');
    //         this.set('amount', amount * 100);
    //         this.set('newSubscription', subscription);
    //
    //         this.get('stripeHandler').open({
    //             panelLabel: 'Subscribe',
    //             description: sprintf('Business Subscription, $%s/%s', amount, (this.get('newSubscription') === 'monthly') ? 'Month' : 'Year')
    //         });
    //     });
    // },

    makeOneTimePayment: function(amount) {
        this.initStripeHandler(function() {
            this.set('amount', amount * 100);
            this.set('newSubscription', null);

            this.get('stripeHandler').open({
                panelLabel: 'Pay',
                description: sprintf('$%s Payment', amount)
            });
        });
    }
});
