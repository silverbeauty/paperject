window.name = 'paperjet-dashboard';

require('scripts/errors-handler');
require('scripts/paperjet-application');

window.App = PaperjetApplication.create({
    clientId: '',
    userId: '',
    socket: null,
    LOG_TRANSITIONS: true,
    THROTTLE_AUTO_SAVE: 500 // milliseconds
});

Ember.View.reopen({
    didInsertElement: function() {
        this._super();

        // init bootstrap tooltips on all route transitions
        if (App.get('isNotMobileDevice')) {
            Ember.run.scheduleOnce('afterRender', function() {
                $('[title]').tooltip();
            });
        }
    }
});

Ember.Application.initializer({
    name: 'dependency-injection',

    initialize: function(container, application) {
        App.register('PdfExportService:main', App.PdfExportService);
        App.inject('component:doc-email', 'pdfExportService', 'PdfExportService:main');
        App.inject('component:doc-fax', 'pdfExportService', 'PdfExportService:main');
        App.inject('controller:indexDocuments', 'pdfExportService', 'PdfExportService:main');

        App.register('PdfJsLoaderService:main', App.PdfJsLoaderService);
        App.inject('PdfExportService:main', 'pdfJsLoaderService', 'PdfJsLoaderService:main');
        App.inject('controller:indexDocuments', 'pdfJsLoaderService', 'PdfJsLoaderService:main');
        App.inject('component:doc-fax', 'pdfJsLoaderService', 'PdfJsLoaderService:main');

        App.register('FileUploadService:main', App.FileUploadService);
        App.inject('controller:indexDocuments', 'fileUploadService', 'FileUploadService:main');
    }
});

/* Order and include as you please. */
require('scripts/clientStorage');
require('scripts/validators');
require('scripts/services/*');
require('scripts/dashboard/controllers/*');
require('scripts/store');
require('scripts/models/*');
require('scripts/dashboard/routes/*');
require('scripts/helpers/*');
require('scripts/components/*');
require('scripts/dashboard/views/*');
require('scripts/views/*');
require('scripts/dashboard/router');
