'use strict';

/*global App, Ember, _*/
App.DocumentFoldersView = Ember.View.extend({
    tagName: 'div',
    templateName: 'document-folders',
    isAddFolderVisible: false,
    newFolderName: '',
    sortDirection: '',


    sortDirectionAsc: false,
    sortDirectionDesc: false,
    sorters: ['displayOrder'],
    sortedFolders: Ember.computed.sort('folders', 'sorters'),

    actions: {
        changeSortDirection: function() {
            if (!this.get('sortDirectionAsc') && !this.get('sortDirectionDesc')) {
                this.set('sortDirectionAsc', true);
            } else if (this.get('sortDirectionAsc') && !this.get('sortDirectionDesc')) {
                this.set('sortDirectionAsc', false);
                this.set('sortDirectionDesc', true);
            } else if (!this.get('sortDirectionAsc') && this.get('sortDirectionDesc')) {
                this.set('sortDirectionAsc', false);
                this.set('sortDirectionDesc', false);
            }
        },

        toggleAddFolderForm: function() {
            this.toggleProperty('isAddFolderVisible');

            if (this.get('isAddFolderVisible')) {
                Ember.run.schedule('afterRender', this, function() {
                    $(this.get('newFolderNameField').element).focus();
                });
            }
        },

        addNewFolder: function() {
            var rec = this.get('controller.store').createRecord('folder', {
                name: this.get('newFolderName')
            });

            App.clearNotificationMessage();
            rec.save().then(_.bind(function() {
                this.setProperties({
                    newFolderName: '',
                    isAddFolderVisible: false
                });
                Ember.run.schedule('afterRender', this, function() {
                    $('.btn-menu').dropdown();

                    this.get('controller').trigger('initDocumentsDragAndDrop');
                    this.get('controller').send('folderChanged', rec);
                });
            }, this)).catch(_.bind(function(why) { // jshint ignore:line
                rec.rollback();

                var error;
                if (why.responseText) {
                    try {
                        error = JSON.parse(why.responseText).message;
                    } catch (e) {
                        error = 'Error: ' + why.responseText;
                    }
                } else {
                    error = 'Unexpected error: ' + why.statusText;
                }

                App.showError(error);
            }, this));
        },

        enableEditMode: function(folder) {
            folder.set('isEditing', true);
        },

        remove: function(folder) {
            // check if there are trashed documents in this folder, and move them into MyDocuments
            if (folder.get('documents.length')) {
                folder.get('documents').forEach(function(doc) {
                    var folders = doc.get('folders');

                    if (folders.anyBy('alias', 'trash')) {
                        folders.removeObject(folder);
                        folders.addObject(this.get('controller.store').all('folder').findBy('alias', 'my-documents'));
                        doc.save();
                    }
                }, this);
            }

            if (folder.get('documents.length')) {
                App.showError('Selected folder is not empty! Please erase it and try again');
            } else {
                folder.destroyRecord().then(_.bind(function() {
                    this.get('controller').send('folderRemoved');
                }, this)).catch(_.bind(function(why) { // jshint ignore:line
                    folder.rollback();

                    var error;
                    if (why.responseText) {
                        try {
                            error = JSON.parse(why.responseText).message;
                        } catch (e) {
                            error = 'Error: ' + why.responseText;
                        }
                    } else {
                        error = 'Unexpected error: ' + why.statusText;
                    }

                    App.showError(error);
                }, this));
            }
        }
    },

    init: function() {
        this._super();
        this.set('folders', this.get('controller.store').all('folder'));
    },

    didInsertElement: function() {
        this._super();
        this.setSortingFlagsByQueryParam();
        $('.btn-menu').dropdown();

        $('body').on('keydown', _.bind(this.onKeyDown, this));
    },

    onKeyDown: function(e) {
        if (e.keyCode === $.ui.keyCode.ESCAPE && this.get('isAddFolderVisible') && this.get('newFolderNameField') && $(this.get('newFolderNameField').element).is(':focus')) {
            this.toggleProperty('isAddFolderVisible');
        }
    },

    onSortDirectionChanged: function() {
        this.setSortingFlagsByQueryParam();
    }.observes('sortDirection'),

    onSorterFlagsChanged: function() {
        if (!this.get('sortDirectionAsc') && !this.get('sortDirectionDesc')) {
            this.set('sorters', ['displayOrder']);
            this.set('sortDirection', '');
        } else if (this.get('sortDirectionAsc') && !this.get('sortDirectionDesc')) {
            this.set('sorters', ['name:asc']);
            this.set('sortDirection', 'asc');
        } else {
            this.set('sorters', ['name:desc']);
            this.set('sortDirection', 'desc');
        }
    }.observes('sortDirectionAsc', 'sortDirectionDesc'),

    setSortingFlagsByQueryParam: function() {
        if (this.get('sortDirection') === 'asc') {
            this.set('sortDirectionAsc', true);
            this.set('sortDirectionDesc', false);
        } else if (this.get('sortDirection') === 'desc') {
            this.set('sortDirectionAsc', false);
            this.set('sortDirectionDesc', true);
        } else {
            this.set('sortDirectionAsc', false);
            this.set('sortDirectionDesc', false);
        }
    }
});
