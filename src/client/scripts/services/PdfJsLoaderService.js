'use strict';

/*global PDFJS*/
App.PdfJsLoaderService = Ember.Object.extend({
    loaded: false,
    version: '',
    rootPath: '', // for CDN support

    init: function() {
        this._super();
        this.set('version', $('meta[name="pdfjs-version"]').attr('content'));
        this.set('rootPath', $('meta[name="pdfjs-root"]').attr('content'));
    },

    onLoad: function() {
        if (this.get('loaded')) {
            PDFJS.workerSrc = this.get('rootPath') + '/scripts/pdfjs' + this.get('version') + '/build/pdf.worker.js';
            PDFJS.cMapUrl = this.get('rootPath') + '/scripts/pdfjs' + this.get('version') + '/cmaps/';
            PDFJS.cMapPacked = true;
            PDFJS.verbosity = PDFJS.VERBOSITY_LEVELS.errors;
        }
    }.observes('loaded'),

    load: function(callback, scope) {
        if (this.get('loaded')) {
            callback.call(scope);
        } else {
            $.ajax({
                url: this.get('rootPath') + '/scripts/pdfjs' + this.get('version') + '/build/pdf.js',
                cache: true,
                type: 'GET',
                dataType: 'script',
                success: _.bind(function() {
                    this.set('loaded', true);
                    callback.call(scope);
                }, this)
            });
        }
    }
});
