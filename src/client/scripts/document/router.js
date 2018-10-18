App.Router = Ember.Router.extend({
    location: 'auto'
});

App.Router.map(function() {
    this.route('doc', {
        path: '/:id'
    });

    this.route('login');
    this.route('forgot-password');
});

App.Router.reopen({
    rootURL: '/document/'
});

// add login handler to all routers
Ember.Route.reopen({
    redirect: function(params, transition) {
        if (this.routeName === 'login') {
            if (this.modelFor('application').get('profile')) {
                this.replaceWith('doc', transition.queryParams.doc);
            }
        } else if (!this.modelFor('application').get('profile')) {
            var whitelistedRoutes = ['forgot-password'];
            if (whitelistedRoutes.indexOf(this.routeName) === -1) {
                this.replaceWith('login');
            }
        }
    }
});
