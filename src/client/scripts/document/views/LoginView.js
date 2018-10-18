'use strict';

/*global Ladda*/
App.LoginView = Ember.View.extend({
    didInsertElement: function() {
        this.initSignatureAccountSpinner();
    },

    initSignatureAccountSpinner: function() {
        if ($('#signature-request-create-account').length) {
            var spinner = Ladda.create($('#signature-request-create-account')[0]);

            this.addObserver('controller.creatingSignatureRequestAccount', this, function() {
                if (this.get('controller.creatingSignatureRequestAccount')) {
                    spinner.start();
                } else {
                    spinner.stop();
                }
            });
        }
    }
});
