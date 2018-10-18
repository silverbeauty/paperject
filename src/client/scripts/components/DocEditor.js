'use strict';

/*global PDFJS,moment*/
App.DocEditorComponent = Ember.Component.extend({
    classNames: ['container'],

    // injected by the app
    pdfExportService: null,

    // fields set with data-binding
    store: null,
    doc: null,
    pages: null,
    form: null,
    formValidationCallback: null,
    sendingForm: false,
    status: '',

    // private fields
    AUTO_SAVE_TIMEOUT: 1000,
    DEFAULT_TEXT_SIZE_PX: 12,
    CSS_FONT_SIZE_RATIO: 0.65,
    CHECKBOX_SIZE_RATIO: 0.6,
    OBJECT_POS_FACTOR: Ember.computed.alias('pdfExportService.OBJECT_POS_FACTOR'),
    pdf: null,
    pdfLoaded: false,
    pageEditors: null, // []
    loadedEditorsCount: 0,
    showPagesTimer: null,
    hideFields: false,
    mobileZoom: false,

    signaturesNotFiltered: [],
    initials: Ember.computed.filterBy('signaturesNotFiltered', 'type', 'initials'),
    signatures: Ember.computed.filterBy('signaturesNotFiltered', 'type', 'signature'),

    selectedSignature: null,
    isSignatureSelected: Ember.computed.equal('selectedSignature.type', 'signature'),
    isInitialsSelected: Ember.computed.equal('selectedSignature.type', 'initials'),

    selectedObjectPropertyPanelClass: '',
    selectedObjectFont: '',

    // toolbar selection
    prevTool: null,
    activeTool: 'text', // text | checkbox | rectangle | move | signatures | signature | signature-request | initials-request
    moveActive: Ember.computed.equal('activeTool', 'move'),
    textActive: Ember.computed.equal('activeTool', 'text'),
    checkboxActive: Ember.computed.equal('activeTool', 'checkbox'),
    rectangleActive: Ember.computed.equal('activeTool', 'rectangle'),
    signaturesActive: Ember.computed.equal('activeTool', 'signatures'),
    // toolbar selection end

    pdfLoadProgress: 0,
    isDirty: false,
    isSaving: false,
    autoSaveTimer: null,
    saveOperations: 0,
    hasPendingSaves: false, // TODO: remove
    awaitingPageSaveForExport: false,
    awaitingPageInsert: {},
    requestedPages: {},

    requiredFields: {},
    requiredFieldsCount: -1,
    hasRequiredFields: false, // cannot use computed property because it's a bound field

    formOrSignatureRequest: function() {
        return !!this.get('form') || !!this.get('doc.signatureRequest');
    }.property('form', 'doc.signatureRequest'),

    requiredFieldsMessage: function() {
        var count = this.get('requiredFieldsCount');
        return count > 0 ? sprintf('Please fill %s required field(s)', count) : '';
    }.property('requiredFieldsCount'),

    isNotMobileDevice: function() {
        return App.get('isNotMobileDevice');
    }.property('App.isNotMobileDevice'),

    activeToolClass: function() {
        return 'tool-' + this.get('activeTool');
    }.property('activeTool'),

    documentEditingEnabled: function() {
        return !this.get('awaitingPageSaveForExport') && !this.get('sendingForm');
    }.property('awaitingPageSaveForExport', 'sendingForm'),

    showSignaturesCountLabel: function() {
        return this.get('signatures.length') > 10;
    }.property('signaturesNotFiltered.@each'),

    showInitialsCountLabel: function() {
        return this.get('initials.length') > 10;
    }.property('signaturesNotFiltered.@each'),

    actions: {
        addSignatureRequest: function() {
            this.set('activeTool', 'signature-request');
        },

        addInitialsRequest: function() {
            this.set('activeTool', 'initials-request');
        },

        hideFields: function() {
            this.toggleProperty('hideFields');
        },

        switchToMoveMode: function() {
            this.set('activeTool', 'move');
        },

        // addRectangle: function() {
        //     this.set('activeTool', 'rectangle');
        // },

        addCheckbox: function() {
            this.set('activeTool', 'checkbox');
        },

        addText: function() {
            this.set('activeTool', 'text');
        },

        showSignatures: function() {
            this.trigger('show-signature-modal', this.get('formOrSignatureRequest'));
            this.set('activeTool', 'signatures');
        },

        showInitialsManager: function() {
            this.trigger('show-initials-modal');
            this.set('activeTool', 'signatures');
        },

        setSelectedObjectStyle: function(property, value, toggleValue) {
            this.trigger('set-selected-object-style', property, value, toggleValue);
        },

        increaseSelectedObjectSize: function() {
            this.trigger('set-selected-object-size', 1.1);
        },

        decreaseSelectedObjectSize: function() {
            this.trigger('set-selected-object-size', 0.9);
        },

        setSelectedObjectFont: function(font) {
            this.trigger('set-selected-object-font', font);
            this.set('selectedObjectFont', font);
        },

        selectSignature: function(signature) {
            this.set('selectedSignature', signature);
            this.set('activeTool', 'signature');
        },

        addFormSignature: function(signature) {
            this.trigger('add-form-signature', signature);
        }
    },

    init: function() {
        this._super();

        if (!this.get('form')) {
            var socket = App.get('socket'),
                userId = App.get('userId');

            socket.on('page.update', _.bind(this.onPageUpdated, this));

            this.get('targetObject').on('export', this, this.onExport);

            this.set('signaturesNotFiltered', this.store.all('signature'));
        }

        var validation = this.get('doc.validation') || this.get('form.validation');

        try {
            if (validation) {
                this.formValidationCallback = new Function('pages', 'setRequiredFields', 'showRequiredSignature', validation); // jshint ignore:line
            }
        } catch (e) {}

        if (this.formValidationCallback) {
            this.formValidationCallback = _.bind(this.formValidationCallback, null, this.get('pages'), _.bind(function(page, fields, required) {
                this.trigger('set-required-fields', page, fields, required);
            }, this), _.bind(function(page, id, show) {
                this.trigger('show-required-signature-request', page, id, show);
            }, this));
        }
    },

    onPageInsert: function() {
        this.get('pages').forEach(function(page) {
            if (this.awaitingPageInsert.hasOwnProperty(page.get('i'))) {
                delete this.awaitingPageInsert[page.get('i')];
                this.normalizePage(page.get('i'));
            }
        }, this);
    }.observes('pages.length'),

    updateStatus: function() {
        if (this.get('isSaving')) {
            this.set('status', 'Saving...');
        } else if (this.get('isDirty')) {
            this.set('status', 'Pending...');
        } else {
            this.set('status', 'Saved');
        }
    }.observes('isSaving', 'isDirty'),

    onPageUpdated: function(data) {
        if (data.clientId !== App.get('clientId')) {
            this.store.find('page', data.id).then(_.bind(function(rec) {
                if (rec) {
                    var updateRec = _.bind(function() {
                        var pageData = data.data;
                        delete pageData.doc;
                        pageData.createdAt = new Date(pageData.createdAt);
                        pageData.updatedAt = new Date(pageData.updatedAt);

                        if (pageData.objects) {
                            for (var j = 0; j < pageData.objects.length; j++) {
                                pageData.objects[j] = Ember.Object.create(pageData.objects[j]);

                                if (pageData.objects[j].style) {
                                    pageData.objects[j].style = Ember.Object.create(pageData.objects[j].style);
                                }
                            }

                            pageData.objects = Ember.A(pageData.objects);
                        }

                        rec.setProperties(pageData);

                        // mark as 'clean', works in ember-data 1.0.0-beta, see http://stackoverflow.com/a/23344215/48724
                        // changing to loaded.updated.inFlight, which has "didCommit"
                        rec.send('willCommit');
                        // clear array of changed (dirty) model attributes
                        rec.set('_attributes', {});
                        // changing to loaded.saved (hooks didCommit event in "inFlight" state)
                        rec.send('didCommit');

                        this.trigger('page-update', rec.id);
                    }, this);

                    if (rec.get('isDirty')) {
                        var onSave = function() {
                            updateRec();
                            rec.off('didUpdate', onSave);
                        };

                        rec.on('didUpdate', onSave);
                    } else {
                        updateRec();
                    }
                }
            }, this));
        }
    },

    onExport: function(args) {
        if (this.get('isDirty')) {
            args.cancel = true;

            var exportWhenSaved = function() {
                this.set('awaitingPageSaveForExport', false);
                this.removeObserver('isDirty', this, exportWhenSaved);
                args.callback();
            };

            App.showNotification('Saving your changes...');
            this.set('awaitingPageSaveForExport', true);
            this.addObserver('isDirty', this, exportWhenSaved);
        }
    },

    renderPdf: function() {
        if (App.get('isNotMobileDevice')) {
            this.renderPdfJsViewer();
        } else {
            this.renderMobilePages();
        }

        if (!this.get('form')) {
            var el = $('#' + this.elementId);
            el.mousemove(_.bind(this.onMouseMove, this));

            el.mouseenter(function() {
                $('#document-tool-indicator').removeClass('document-tool-indicator-inactive');
            });

            el.mouseleave(function() {
                $('#document-tool-indicator').addClass('document-tool-indicator-inactive');
            });
        }

        this.updateStatus();
    }.on('didInsertElement'),

    renderPdfJsViewer: function() {
        var container = $('#' + this.elementId + ' .doc-editor-container')[0],
            pdfViewer,
            progressCallback;

        pdfViewer = new PDFJS.PDFViewer({
            container: container
        });

        progressCallback = _.bind(function(progress) {
            Ember.run.throttle(this, function(progress) {
                this.set('pdfLoadProgress', Math.round((progress.loaded / progress.total) * 100));
            }, progress, 250);
        }, this);

        container.addEventListener('pagesinit', _.bind(function() {
            // we can use pdfViewer now, e.g. let's change default scale.
            pdfViewer.currentScaleValue = 'page-width';

            var numPages = this.get('doc.pageCount');

            this.set('pageEditors', new Array(numPages));

            for (var i = 1; i <= numPages; i++) {
                $('#pageContainer' + i).on('pagerendered', _.bind(this.createPageEditor, this, i));
            }
        }, this));

        PDFJS.getDocument(this.get('doc.fileUrl'), null, null, progressCallback).then(_.bind(function(pdf) {
            Ember.run(this, function() {
                this.set('pdf', pdf);
                this.set('pdfLoaded', true);
                pdfViewer.setDocument(pdf);

                if (pdf.numPages > 6) {
                    $(document).scroll(_.bind(this.onScroll, this));
                }
            });
        }, this));
    },

    renderMobilePages: function() {
        var container = $('#' + this.elementId + ' .doc-editor-container'),
            numPages = this.get('doc.pageCount');

        this.set('pdfLoaded', true);
        this.set('pageEditors', new Array(numPages));

        $('#btn-mobile-zoom').on('touchend', _.bind(this.toggleProperty, this, 'mobileZoom'));
        $('#btn-mobile-hide-fields').on('touchend', _.bind(this.toggleProperty, this, 'hideFields'));

        for (var i = 1; i <= numPages; i++) {
            container.append(sprintf('<div id="pageContainer%s" class="mobile-page-container page" style="height:400px"></div>', i));
            this.createPageEditor(i);
        }

        if (numPages > 4) {
            $(document).scroll(_.bind(this.onScroll, this));
        }
    },

    createPageEditor: function(i) {
        var el = $('#pageContainer' + i),
            editor = App.PageEditor.create({
                i: i,
                el: el,
                parent: this,
                OBJECT_POS_FACTOR: this.get('pdfExportService.OBJECT_POS_FACTOR')
            });

        this.get('pageEditors')[i - 1] = editor;

        editor.on('change', this, this.onPageChange);

        editor.on('set-active-tool-text', this, function() {
            this.set('activeTool', 'text');
        });

        editor.addObserver('requiredFieldsLoaded', this, function() {
            this.incrementProperty('loadedEditorsCount');
        });

        editor.on('select', this, function(editor, type, fontFamily) {
            this.trigger('select', editor); // other editors deselect their objects

            this.set('selectedObjectPropertyPanelClass', type ? 'properties-' + type : '');

            var fontName = 'Helvetica';

            if (fontFamily) {
                if (fontFamily.indexOf('Helvetica') !== -1) {
                    fontName = 'Helvetica';
                }

                // if (fontFamily.indexOf('Arial') !== -1) {
                //     fontName = 'Arial';
                // }

                if (fontFamily.indexOf('Times') !== -1) {
                    fontName = 'Times';
                }

                // if (fontFamily.indexOf('Tahoma') !== -1) {
                //     fontName = 'Tahoma';
                // }

                if (fontFamily.indexOf('Courier') !== -1) {
                    fontName = 'Courier';
                }
            }

            this.set('selectedObjectFont', fontName);
        });

        editor.on('set-previous-active-tool', this, function(editor) {
            this.set('activeTool', this.get('prevTool'));
        });

        this.normalizePage(i);

        if (this.get('doc.pageCount') > 6) {
            this.onScroll();
        } else {
            editor.show();
        }
    },

    normalizePage: function(i) {
        var page = this.get('pages').findBy('i', i);

        if (page) {
            var viewportHeightPx = page.get('h') / 2.54 * 96,
                OBJECT_POS_FACTOR = this.get('pdfExportService.OBJECT_POS_FACTOR'),
                defaultObjectSize = OBJECT_POS_FACTOR * ((this.DEFAULT_TEXT_SIZE_PX / viewportHeightPx) / this.CSS_FONT_SIZE_RATIO),
                canvasHeight = $('#pageContainer' + i).height();

            if (i === 1) {
                $('#document-tool-indicator .fa-check-square-o').css({
                    fontSize: (this.CHECKBOX_SIZE_RATIO * defaultObjectSize * canvasHeight / OBJECT_POS_FACTOR) + 'px'
                });
            }

            this.get('pageEditors')[i - 1].setProperties({
                page: page,
                defaultObjectSize: defaultObjectSize
            });
        } else {
            this.awaitingPageInsert[i] = true;
        }
    },

    onMouseMove: function(e) {
        if (this.get('activeTool') !== 'move') {
            var indicator = $('#document-tool-indicator');

            if (($(e.target).hasClass('page-object') || $(e.target).parents('.page-object').length) && this.get('activeTool') !== 'signature') {
                indicator.css({
                    opacity: 0
                });
            } else {
                indicator.css({
                    opacity: 1,
                    left: e.pageX - $(document).scrollLeft() + 5,
                    top: e.pageY - $(document).scrollTop() - indicator.outerHeight() - 5
                });
            }
        }
    },

    setPrevTool: function() {
        var activeTool = this.get('activeTool');

        if (activeTool !== 'signature' && activeTool !== 'signatures') {
            this.set('prevTool', activeTool);
        }
    }.observesBefore('activeTool'),

    onPageChange: function(page) {
        if (!this.get('form') && !this.get('doc.readOnly')) {
            this.set('isDirty', true);
            page.send('becomeDirty');

            Ember.run.cancel(this.autoSaveTimer);
            this.autoSaveTimer = Ember.run.later(this, this.saveDocAndPages, this.AUTO_SAVE_TIMEOUT);
        }

        this.validate();
    },

    validate: _.throttle(function() {
        if (this.formValidationCallback) {
            try {
                this.formValidationCallback();
            } catch (e) {}
        }
    }, 200, {
        leading: false
    }),

    saveDocAndPages: function() {
        this.autoSaveTimer = null;

        if (this.saveOperations) {
            // don't execute AJAX requests while other requests are still running
            this.hasPendingSaves = true;
            return;
        }

        this.set('isSaving', true);
        this.hasPendingSaves = false;

        var doc = this.get('doc'),
            changed = false,
            showError = function(message) {
                App.showError(message);
                this.set('isSaving', false);
            },
            hideSaveLoading = function() {
                this.saveOperations = this.saveOperations - 1;

                if (this.saveOperations === 0) {
                    if (this.hasPendingSaves) {
                        this.saveDocAndPages();
                    } else {
                        this.set('isSaving', false);
                        this.set('isDirty', false);
                    }
                }
            };

        if (doc.get('isDirty')) {
            changed = true;
            this.saveOperations = this.saveOperations + 1;
            doc.save().then(_.bind(hideSaveLoading, this), _.bind(showError, this, 'Failed to save document'));
        }

        this.get('pages').forEach(function(page) {
            if (page.get('isDirty')) {
                changed = true;
                this.saveOperations = this.saveOperations + 1;

                if (page.get('updatedAt') === this.get('lastRenderedPageDate')) {
                    var pageUpdatedAt = this.get('lastRenderedPageDate');

                    page.one('didUpdate', this, function() {
                        if (pageUpdatedAt === this.get('lastRenderedPageDate')) { // check if page is not changed
                            // we're saving same page that is rendered in the view, so there is no need to re-render it after save
                            this.set('lastRenderedPageDate', page.get('updatedAt'));
                        }
                    });
                }

                page.save().then(_.bind(hideSaveLoading, this), _.bind(showError, this, 'Failed to save page'));
            }
        }, this);

        if (!changed) {
            this.set('isSaving', false);
            this.set('isDirty', false);
        }
    },

    onScroll: function() {
        Ember.run.throttle(this, this.showPages, 500);
    },

    showPages: function() {
        var page = this.getFirstVisiblePageIndex(),
            limit = App.get('isNotMobileDevice') ? 3 : 2,
            start = Math.max(0, page - limit),
            end = Math.min(this.get('doc.pageCount'), page + limit),
            editors = this.get('pageEditors'),
            requestPages = [];

        for (var i = 0; i < editors.length; i++) {
            if (editors[i]) {
                if (i >= start && i < end) {
                    editors[i].show();

                    // first two pages and last one are already prioritized
                    if (i > 1 && i !== editors.length - 1 && !editors[i].get('page')) {
                        if (!this.requestedPages.hasOwnProperty(i + 1)) {
                            requestPages.push(i + 1);
                            this.requestedPages[i + 1] = true;
                        }
                    }
                } else {
                    editors[i].hide();
                }
            }
        }

        this.validate();

        if (requestPages.length) {
            $.ajax({
                url: sprintf('/api/v1.0/users/%s/documents/%s', App.get('userId'), this.get('doc.id')),
                type: 'POST',
                data: JSON.stringify({
                    action: 'requestPages',
                    pages: requestPages
                }),
                contentType: 'application/json',
                cache: false,
                dataType: 'json',
                processData: false // Don't process the files
            });
        }
    },

    // Returns last page that has top < scrollTop
    getFirstVisiblePageIndex: function() {
        var top = $(document).scrollTop(),
            editors = this.get('pageEditors'),
            binarySearch = function(start, end) {
                if (start === end - 1) {
                    return start;
                }

                var mid = Math.floor(start + (end - start) / 2);

                while (!editors[mid] && mid >= start) {
                    --mid;
                }

                if (mid === start || !editors[mid]) {
                    return start;
                }

                if (editors[mid].get('el').offset().top <= top) {
                    return binarySearch(mid, end);
                }

                return binarySearch(start, mid);
            };

        return binarySearch(0, editors.length);
    },

    onRequiredFieldsCountChange: function() {
        this.set('hasRequiredFields', !!this.get('requiredFieldsCount'));
        this.validate();
    }.observes('requiredFieldsCount'),

    // wait until all pages are loaded, and check if we need to enable Done button
    checkRequiredFieldsCount: function() {
        if (this.get('loadedEditorsCount') === this.get('doc.pageCount') && this.get('requiredFieldsCount') === -1) {
            // this is called when all pages are loaded, and form doesn't have required fields
            this.set('requiredFieldsCount', 0);
        }
    }.observes('loadedEditorsCount')
});
