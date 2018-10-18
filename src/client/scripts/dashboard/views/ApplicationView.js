App.ApplicationView = Ember.View.extend({
    didInsertElement: function() {
        $('#app-loading').remove();
    }
});
