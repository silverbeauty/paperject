'use strict';

App.RegisterRoute = Ember.Route.extend({
    afterModel: function() {
        var profile = this.modelFor('application').get('profile');

        if (profile && profile.get('id')) {
            this.transitionTo('index.documents');
        }
    }
});
