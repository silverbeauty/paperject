'use strict';

App.ErrorView = Ember.View.extend({
    isForm: false,

    isRegisteredUser: function() {
        return App.get('isRegisteredUser');
    }.property('App.isRegisteredUser'),

    didInsertElement: function() {
        document.title = 'Paperjet. Go Paperless';

        this.set('isForm', !!(/(\?form=[a-z0-9]{24})$/i).exec(window.location.href));
    }
});
