App.Router = Ember.Router.extend({
    location: 'auto'
});

App.Router.map(function() {
    this.route('dashboard', {
        path: '/'
    });
});

App.Router.reopen({
    rootURL: '/admin/'
});
