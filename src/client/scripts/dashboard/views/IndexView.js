'use strict';

/*global Ladda*/
App.IndexView = Ember.View.extend({
    didInsertElement: function() {
        this.initRegisterSpinner();

        $('#reg-login-tabs a[data-toggle="tab"]').on('shown.bs.tab', _.bind(function (e) {
            var activeTabName = $(e.target).attr('aria-controls');
            this.set('controller.activeTabName', activeTabName);
        }, this));

        App.checkBrowser();
    },


    // FIX: should it be in the RegisterModalView?
    initRegisterSpinner: function() {
        var regSpinner = Ladda.create($('#register-btn')[0]);
            // TODO: loginSpinner = Ladda.create($('#login-btn')[0]);

        this.addObserver('controller.isRegProcessing', this, function() {
            if (this.get('controller.isRegProcessing')) {
                regSpinner.start();
            } else {
                regSpinner.stop();
            }
        });

        // this.addObserver('controller.isLoginProcessing', this, function() {
        //     if (this.get('controller.isLoginProcessing')) {
        //         loginSpinner.start();
        //     } else {
        //         loginSpinner.stop();
        //     }
        // });
    }
});
