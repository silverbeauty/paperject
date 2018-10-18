/*global Ladda*/
App.RegisterView = Ember.View.extend({
    didInsertElement: function() {
        this.initRegisterSpinner();
    },

    initRegisterSpinner: function() {
        var spinner = Ladda.create($('#register-btn')[0]);

        this.addObserver('controller.isProcessing', this, function() {
            if (this.get('controller.isProcessing')) {
                spinner.start();
            } else {
                spinner.stop();
            }
        });
    }
});

