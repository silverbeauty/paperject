App.Router = Ember.Router.extend({
    location: 'auto'
});

App.Router.map(function() {
    this.resource('index', {
        path: '/'
    }, function() {
        this.route('documents');
    });

    this.route('login');
    this.route('register');
    this.route('forgot-password');

    this.resource('reset-password', {
        path: 'reset-password/:hash'
    });

    this.route('password-reset-success');
});

App.Router.reopen({
    rootURL: '/dashboard/'
});

// add login handler to all routers
Ember.Route.reopen({
    redirect: function(model) {
        // if browser's 'back' or 'forward' button is clicked, we have to remove modal's backdrop because it's appended outside of outlet
        $('.modal-backdrop').remove();

        if (this.routeName === 'login') {
            if (this.modelFor('application').get('profile')) {
                this.transitionTo('index.documents');
            }
        } else if (!this.modelFor('application').get('profile')) {
            var whitelistedRoutes = ['register', 'application', 'forgot-password', 'reset-password', 'password-reset-success'];
            if (whitelistedRoutes.indexOf(this.routeName) === -1) {
                this.transitionTo('login');
            }
        }
    }
});
