App.ResetPasswordRoute = Ember.Route.extend({
    model: function(params) {
        return Ember.Object.create({
            hash: params.hash
        });
    }
});
