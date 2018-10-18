'use strict';

/*global Ladda*/

App.IndexDocumentsView = Ember.View.extend({
    classNames: ['index-documents-container'],
    paginationUpdateTimerId: 0,
    file: null,


    didInsertElement: function() {
        this.get('controller').on('initPagination', _.bind(this.initPagination, this));

        this.get('controller').on('hidePagination', function() {
            $('#documents-pagination').hide();
        });

        this.get('controller').on('initDocumentsDragAndDrop', _.bind(this.initDocumentsDragAndDrop, this));

        this.initDropZones();

        $('.fileinput').on('change.bs.fileinput', _.bind(this.onFileUploadChange, this));
        $('#documents-upload-file-input').on('change', _.bind(this.onFileUploadChange, this));

        $(document).click(_.bind(function(e) {
            // controller must close menu  when something except the menu is clicked
            var el = $(e.target);

            if (!el.closest('.doc-menu').length && !el.closest('.popover-content').length && !el.closest('.js-clear-sent').length) {
                $('.popover').popover('hide');
            }
        }, this));

        $(document).keydown(_.bind(this.customKeyDown, this));
        this.initSampleUploadSpinner();
    },

    initSampleUploadSpinner: function() {
        this.addObserver('controller.uploadingSampleForm', this, function() {
            var spinner = Ladda.create($('#sample-upload-btn')[0]);

            if (spinner) {
                if (this.get('controller.uploadingSampleForm')) {
                    spinner.start();
                } else {
                    spinner.stop();
                }
            }
        });
    },

    willDestroyElement: function() {
        //unbind events required for fullscreeen drag&drop on this page
        $('body').off('dragover');
        $('body').off('dragleave');
        $('body').off('drop');
    },

    customKeyDown: function(e) {
        var KEY_UP_CODE = 38,
            KEY_DOWN_CODE = 40,
            KEY_A_CODE = 65,
            ESC_KEY_CODE = 27,
            isElementInViewport = function(el) {
                if (typeof jQuery === "function" && el instanceof jQuery) {
                    el = el[0];
                }
                var rect = el.getBoundingClientRect();

                return (rect.top >= $('.navbar').height() && rect.bottom <= $(window).height());
            };
        if (e.which === ESC_KEY_CODE) {
            this.get('controller').send('cancelSelection');
        } else if (e.which === KEY_UP_CODE) {
            this.get('controller').send('moveDocumentSelection', 'up');
            Ember.run.scheduleOnce('afterRender', function() {
                var selectedItem = $('.documents-list .selected');
                if (!isElementInViewport(selectedItem) && selectedItem.offset()) {
                    $('html, body').animate({
                        scrollTop: (selectedItem.offset().top - selectedItem.outerHeight())
                    }, 100);
                }
            });

            e.preventDefault();
        } else if (e.which === KEY_DOWN_CODE) {
            this.get('controller').send('moveDocumentSelection', 'down');
            Ember.run.scheduleOnce('afterRender', function() {
                var selectedItem = $('.documents-list .selected');
                if (!isElementInViewport(selectedItem) && selectedItem.offset()) {
                    $('html, body').animate({
                        scrollTop: (selectedItem.offset().top - selectedItem.outerHeight())
                    }, 100);
                }
            });
            e.preventDefault();
        } else if (e.ctrlKey && (e.which === KEY_A_CODE)) {
            e.preventDefault();
            this.set('controller.areAllDocsSelected', true);
        }
    },

    click: function(e) {
        if ($(e.target).hasClass('delete-doc-confirm')) {
            var id = $(e.target).attr('data-doc-menu-id');
            this.get('controller').send('removeSelected', (id !== '0') ? id : null);
            $('.popover').popover('hide');
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if ($(e.target).closest('.popup-menu').length) {
            $('.popover').popover('hide');
        }

        if ($(e.target).hasClass('documents-btn-upload')) {
            $('.fileinput').fileinput('clear');
            $('#documents-upload-filename').html('');
            return;
        }

        if ($(e.target).hasClass('popover')) {
            e.preventDefault();
            e.stopPropagation();
        }
    },

    onFileUploadChange: function(e) {
        var input = $('.fileinput input[type="file"]');

        if (!input || !input.length) {
            input = $('#documents-upload-file-input');
        }

        if (input && input.length && input[0].files && input[0].files.length) {
            this.get('controller').uploadFile(input[0].files[0]);

            input.wrap('<form>').closest('form').get(0).reset();
            input.unwrap();
        }
    },

    initPagination: function() {
        var currentPage = this.get('controller.currentPage'),
            totalPages = this.get('controller.totalPages');
        $('#documents-pagination').show().bootpag({
                total: totalPages,
                page: currentPage,
                maxVisible: 6
            })
            .on('page', _.bind(function(event, pageNum) {
                this.set('controller.currentPage', pageNum);
            }, this));
    },

    initDocumentsDragAndDrop: function() {
        var draggableSelector = '.documents-list .item';

        $(draggableSelector).draggable({
            revert: 'invalid',
            cursorAt: {
                top: -5,
                left: -5
            }
        });

        $('.folders .folder.ui-droppable').droppable('destroy');
        $('.folders .folder:not(.active)').droppable({
            accept: draggableSelector,
            activeClass: "ui-state-hover",
            hoverClass: "ui-state-active",
            drop: _.bind(function(event, ui) {
                var documentId = ui.draggable.attr('data-doc-id'),
                    folderId = $(event.target).attr('data-folder-id');
                ui.draggable.remove();

                this.get('controller').send('moveDocuments', documentId, folderId);

                //Sometimes hover class is not removed. Remove it implicity
                $('.ui-droppable.ui-state-hover').removeClass('ui-state-hover');
            }, this)
        });
    },

    initDropZones: function() {
        if (this.get('controller.controllers.application.model.profile.supportsUpload')) {
            this.get('controller.fileUploadService').createDropZone({
                target: $('.main-drop-area'),
                setUploading: _.bind(function(uploading) {
                    this.set('controller.uploading', uploading);
                }, this),
                success: function(data) {
                    App.showNotification(data.detectorMessage, true);
                },
                error: function(errorMessage) {
                    App.showError(errorMessage);
                }
            });

            this.get('controller.fileUploadService').createDropZone({
                target: $('body'),
                isFullscreen: true,
                setUploading: _.bind(function(uploading) {
                    this.set('controller.uploading', uploading);
                }, this),
                success: function(data) {
                    App.showNotification(data.detectorMessage, true);
                },
                error: function(errorMessage) {
                    App.showError(errorMessage);
                }
            });
        }
    },

    blurPrintButton: function() {
        $('#tb-doc-print').blur();
    }.observes('controller.isPrintingPrepared'),

    blurDownloadButton: function() {
        $('#tb-doc-download').blur();
    }.observes('controller.isDownloadPrepared'),

    blurCloneBtn: function() {
        $('#tb-doc-clone').blur();
    }.observes('controller.cloning')
});
