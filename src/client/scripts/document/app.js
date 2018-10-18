require('scripts/errors-handler');
require('scripts/paperjet-application');

window.App = window.PaperjetApplication.extend({
    // LOG_TRANSITIONS: true,
    // LOG_TRANSITIONS_INTERNAL: true,
    // LOG_VIEW_LOOKUPS: true,
    THROTTLE_AUTO_SAVE: 500, // milliseconds

    socket: null,
    clientId: '',
    userId: '',

    isRegisteredUser: function() {
        return this.get('userId') && this.get('userId').indexOf('non-registered-user') === -1;
    }.property('userId')
}).create();

Ember.Application.initializer({
    name: 'dependency-injection',

    initialize: function(container, application) {
        App.register('PdfExportService:main', App.PdfExportService);

        App.inject('component:doc-editor', 'pdfExportService', 'PdfExportService:main');
        App.inject('component:doc-email', 'pdfExportService', 'PdfExportService:main');
        App.inject('component:doc-fax', 'pdfExportService', 'PdfExportService:main');
        App.inject('controller:doc', 'pdfExportService', 'PdfExportService:main');

        App.register('PdfJsLoaderService:main', App.PdfJsLoaderService);
        App.inject('PdfExportService:main', 'pdfJsLoaderService', 'PdfJsLoaderService:main');
        App.inject('component:doc-fax', 'pdfJsLoaderService', 'PdfJsLoaderService:main');
        App.inject('controller:doc', 'pdfJsLoaderService', 'PdfJsLoaderService:main');

        App.register('FileUploadService:main', App.FileUploadService);
        App.inject('controller:application', 'fileUploadService', 'FileUploadService:main');
    }
});

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

(function redirectToNewEditor() {
    var errorHandler = Ember.onerror,
        redirecting = false;

    Ember.onerror = function(error) {
        if (redirecting) {
            return;
        }

        if (error && error.name === 'UnrecognizedURLError') {
            var re = /^\/([a-z0-9]{24})/i,
                items = re.exec(error.message);

            if (items && items.length === 2) {
                window.location = '/document/' + items[1];
                redirecting = true;
                return;
            }
        }

        errorHandler(error);
    };
})();

/* Order and include as you please. */
require('scripts/clientStorage');
require('scripts/validators');
require('scripts/services/*');
require('scripts/document/controllers/*');
require('scripts/store');
require('scripts/models/*');
require('scripts/document/routes/*');
require('scripts/helpers/*');
require('scripts/components/*');
require('scripts/document/views/*');
require('scripts/views/*');
require('scripts/document/router');
require('scripts/document/plugins/*');
require('scripts/PageEditor');
