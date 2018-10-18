require('scripts/errors-handler');
require('scripts/paperjet-application');

window.App = window.PaperjetApplication.extend({
    // LOG_TRANSITIONS: true,
    // LOG_TRANSITIONS_INTERNAL: true,
    // LOG_VIEW_LOOKUPS: true,
}).create();

Ember.View.reopen({
    didInsertElement: function() {
        this._super();

        if (App.get('isNotMobileDevice')) {
            // init bootstrap tooltips on all route transitions
            Ember.run.scheduleOnce('afterRender', function() {
                $('[title]').tooltip();
            });
        }
    }
});

require('scripts/admin/components/*');
require('scripts/admin/controllers/*');
// require('scripts/store');
// require('scripts/models/*');
require('scripts/admin/routes/*');
// require('scripts/helpers/*');
// require('scripts/components/*');
require('scripts/admin/views/*');
// require('scripts/views/*');
require('scripts/admin/router');
// require('scripts/admin/plugins/*');
// require('scripts/PageEditor');
