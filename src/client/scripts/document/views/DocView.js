'use strict';

App.DocView = Ember.View.extend({
    showSendDialog: function() {
        $('#doc-send').modal('show');
    },

    didInsertElement: function() {
        this.get('controller').on('showSendDialog', this, this.showSendDialog);
        App.checkBrowser();
        document.title = sprintf('%s - Paperjet', this.get('controller.model.doc.name'));

        if (this.get('controller.model.form.homepage')) {
            $('.navbar-brand-logo').attr('href', this.get('controller.model.form.homepage'));
        }

        if (this.get('controller.model.form.homepageTitle')) {
            $('.navbar-brand-logo').tooltip('destroy');
            $('.navbar-brand-logo').attr('title', this.get('controller.model.form.homepageTitle'));
            $('.navbar-brand-logo').tooltip();
        }
    }
});
