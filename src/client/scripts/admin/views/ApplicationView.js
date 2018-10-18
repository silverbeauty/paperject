App.ApplicationView = Ember.View.extend({
    classNames: ['app-container'],

    didInsertElement: function() {
        $('#app-loading').remove();
    }
});
