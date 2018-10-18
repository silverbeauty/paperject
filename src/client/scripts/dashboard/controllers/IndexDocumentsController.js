'use strict';

/*global PDFJS*/
App.IndexDocumentsController = Ember.ArrayController.extend(Ember.Evented, {
    // events: initPagination, hidePagination, initDocumentsDragAndDrop
    needs: [
        'application', // to get profile
        'index'
    ],

    queryParams: [{
        'documentNameFilter': 'name'
    }, {
        'selectedFolderAlias': 'folder'
    }, {
        'foldersSortDirection': 'folders-sort'
    }, {
        'sorters': 'sort'
    }, {
        'currentPage': 'page'
    }, {
        'goProQueryParam': 'gopro'
    }, {
        'inviteQueryParam': 'invite'
    }],

    goProQueryParam: '',
    inviteQueryParam: '',

    pdfJsLoaderService: null, // injected
    pdfExportService: null, // injected

    sentItems: [],
    folders: [],
    documentPerPageCnt: 10,
    currentPage: 1,
    totalPages: 1,
    selectedFolderAlias: '',
    foldersSortDirection: '',

    // value to be used for query param
    documentNameFilter: '',
    //value to be binded to value of search field
    documentNameFilterVal: '',

    uploadErrorMessage: '',
    updateRouteTimer: null,
    documentMenu: null,

    activeFolder: null,
    activeFolderDocuments: null,
    docsFilteredByName: null,
    myDocumentsFolder: null,
    showSentDocuments: false,

    sendingDocument: null,
    sendingDocumentPages: null,
    sendDialogActiveTab: 'email',

    areAllDocsSelected: false,
    lastSelectedDocIndex: -1,
    isPrintingPrepared: false,
    emailPrepared: false,
    faxPrepared: false,
    isDownloadPrepared: false,
    cloning: false,
    uploadingSampleForm: false,

    sorters: ['id:desc'],
    sortersData: Ember.Object.create({
        name: Ember.Object.create({
            asc: false,
            desc: false
        }),
        compositeUpdatedAt: Ember.Object.create({
            asc: false,
            desc: false
        })
    }),

    isTrashActiveFolder: Ember.computed.equal('activeFolder.alias', 'trash'),
    isInboxActiveFolder: Ember.computed.equal('activeFolder.alias', 'inbox'),
    sortedDocuments: Ember.computed.sort('docsFilteredByName', 'sorters'),
    isAnonymousLogged: Ember.computed.alias('controllers.application.model.profile.isAnonymous'),

    promoPro: false,
    promoInvite: false,

    isNotMobileDevice: function() {
        return App.get('isNotMobileDevice');
    }.property(),

    pagedDocs: function() {
        var startIndex,
            endIndex,
            slicedDocs,
            documentIndex = 0,
            areAllDocsSelected = true,
            activeFolderDocs = this.get('sortedDocuments').filter(_.bind(function(document) {
                if (this.get('activeFolder.alias') === 'trash') {
                    return true;
                }

                return !document.get('folders').findBy('alias', 'trash');
            }, this));

        this.set('totalPages', Math.ceil(activeFolderDocs.length / this.get('documentPerPageCnt')));

        if (this.get('currentPage') > this.get('totalPages')) {
            this.set('currentPage', 1);
        }

        startIndex = (this.get('currentPage') - 1) * this.get('documentPerPageCnt');
        endIndex = startIndex + this.get('documentPerPageCnt');
        slicedDocs = activeFolderDocs.slice(startIndex, endIndex);

        Ember.run.scheduleOnce('afterRender', this, function() {
            if (this.get('totalPages') > 1) {
                this.trigger('initPagination');
            } else {
                this.trigger('hidePagination');
            }

            if (this.get('activeFolder.alias') !== 'trash') {
                this.trigger('initDocumentsDragAndDrop');
            }
        });

        slicedDocs.forEach(function(doc) {
            doc.set('indexOnPage', documentIndex++);
            areAllDocsSelected = areAllDocsSelected && doc.get('isSelected');
        });
        //uncheck 'Select all' checkbox if not all docs on the page are selected
        this.set('areAllDocsSelected', areAllDocsSelected);

        return slicedDocs;
    }.property('sortedDocuments.@each', 'sortedDocuments.@each.folders.length', 'documentPerPageCnt', 'currentPage'),


    actions: {
        showSentDocuments: function() {
            this.set('selectedFolderAlias', 'sent');
            this.set('showSentDocuments', true);
            this.get('folders').forEach(function(folder) {
                folder.set('isActive', false);
            });
        },

        openFileSelectDialog: function() {
            $('input[type=file]').trigger('click');
        },

        dismissUploadErrorMessage: function() {
            this.set('uploadErrorMessage', '');
        },

        folderChanged: function(folder) {
            this.set('showSentDocuments', false);
            var prevFolderAlias = this.get('selectedFolderAlias');

            this.get('folders').forEach(function(folder) {
                folder.set('isActive', false);
            });
            folder.set('isActive', true);

            this.set('activeFolder', folder);
            this.set('activeFolderDocuments', folder.get('documents'));
            this.set('docsFilteredByName', folder.get('documents'));
            this.set('selectedFolderAlias', folder.get('alias'));

            if (prevFolderAlias !== folder.get('alias')) {
                this.cancelSelection();
            }
        },

        changeSortDirection: function(curProperty) {
            var sortersData = this.get('sortersData'),
                curSortersData = sortersData.get(curProperty),
                updatedSorters = [],
                propName,
                sorter;

            // reverse sorting order for selected column
            if (curSortersData.get('asc')) {
                curSortersData.setProperties({
                    'asc': false,
                    'desc': true
                });
            } else if (curSortersData.get('desc')) {
                curSortersData.setProperties({
                    'asc': false,
                    'desc': false
                });
            } else {
                curSortersData.setProperties({
                    'asc': true,
                    'desc': false
                });
            }

            //build new sorters array based on updated sorters details
            for (propName in curSortersData.getProperties('name', 'compositeUpdatedAt')) {
                if (sortersData.get(propName).asc || sortersData.get(propName).desc) {
                    if (sortersData.get(propName).asc) {
                        sorter = propName + ':asc';
                    }
                    if (sortersData.get(propName).desc) {
                        sorter = propName + ':desc';
                    }
                    updatedSorters.push(sorter);
                }
            }

            this.set('sorters', updatedSorters.length ? updatedSorters : ['id:desc']);
        },

        createForm: function(doc) {
            $.ajax({
                url: sprintf('/api/v1.0/users/%s/documents/%s/forms', App.get('userId'), doc.get('id')),
                type: 'POST',
                cache: false,
                contentType: 'application/json',
                dataType: 'json',
                context: this,
                success: function(data) {
                    App.showNotification('Created form ' + data.url);
                },
                error: function(xhr) {
                    App.showError('Failed to create Form.');
                }
            });
        },

        selectDocument: function(doc) {
            doc.set('isSelected', !doc.get('isSelected'));
            this.set('lastSelectedDocIndex', doc.get('indexOnPage'));
        },

        openLink: function(url) {
            window.open(url, "_self");
        },

        renameSelected: function(doc) {
            doc = doc || this.get('firstSelectedDocument');

            if (doc) {
                doc.set('isEditing', !doc.get('isEditing'));
            }
        },

        showRemoveConfirmation: function(doc) {
            // FIX: this should be in the View
            if (doc || (this.get('selectedDocuments').length > 0)) {
                if (this.get('activeFolder.alias') === 'trash') {
                    //ask user before complete removing
                    var question = ((doc || (this.get('selectedDocuments').length === 1))) ?
                        'The document will be completely removed. Are you sure?' :
                        'Selected documents will be completely removed. Are you sure?',
                        documentId = doc ? doc.get('id') : 0,
                        el = doc ? $('.popup-menu .remove-document') : $('#tb-doc-delete-btn'),
                        confirm = el.popover({
                            html: true,
                            content: '<div>' + question + '</div>' +
                                '<div style="padding-top:10px"><button type="button" class="btn btn-danger btn-block delete-doc-confirm" data-doc-menu-id="' +
                                documentId + '">Delete</button></div>',
                            trigger: 'manual',
                            placement: 'left'
                        });

                    confirm.popover('show');
                } else {
                    //moved to Trash without confirmation
                    this.moveToTrash(doc);
                }
            }
        },

        restoreDocuments: function() {
            var trashFolder = this.store.all('folder').findBy('alias', 'trash');

            this.get('selectedDocuments').forEach(_.bind(function(doc) {
                // de-associate the document with the Trash folder
                this.changeDoc(doc, function(rec) {
                    rec.set('isSelected', false);
                    rec.get('folders').removeObject(trashFolder);
                    trashFolder.get('documents').removeObject(rec);
                }, function(rec) {
                    rec.set('isSelected', false);
                    rec.get('folders').pushObject(trashFolder);
                    trashFolder.get('documents').pushObject(rec);
                });
            }, this));
        },

        removeSelected: function(documentId) {
            var selectedDocuments = documentId ? this.get('sortedDocuments').filterBy('id', documentId) : this.get('selectedDocuments'),
                activeFolderAlias;

            if (selectedDocuments.length > 0) {
                activeFolderAlias = this.get('activeFolder.alias');

                if (activeFolderAlias === 'trash') {
                    // user is in the Trash folder - remove selected docs completely
                    selectedDocuments.forEach(_.bind(function(currentDoc) {
                        var onSuccess = function() {
                                this.get('activeFolder.documents').removeObject(currentDoc);
                            },
                            onError = function() {
                                this.showError('Failed to delete document');
                                currentDoc.rollback();
                            };

                        currentDoc.destroyRecord().then(_.bind(onSuccess, this), _.bind(onError, this));
                    }, this));
                }
            }
        },

        downloadDocument: function(doc) {
            if (this.get('isAnonymousLogged')) {
                return $('#register-modal').modal('show');
            }
            if (!this.get('controllers.application.model.profile.isEmailConfirmed')) {
                return App.showError(App.CONFIRM_EMAIL_MESSAGE);
            }

            doc = doc || this.get('firstSelectedDocument');

            if (doc) {
                App.showNotification('Preparing your download', true);
                this.set('isDownloadPrepared', true);

                this.store.find('page', {
                    doc: doc.get('id')
                }).then(_.bind(function(pages) {
                    this.pdfExportService.savePrintedPdf(doc, pages.toArray(), true, null, _.bind(function(err, printUrl) {
                        this.set('isDownloadPrepared', false);

                        if (err) {
                            App.showError(err);
                        } else {
                            window.location = printUrl;
                        }
                    }, this));
                }, this));
            }
        },

        toggleDocumentRename: function() {
            this.get('firstSelectedDocument').toggleProperty('isEditing');
        },

        showSendDialog: function(activeTab) {
            if (this.get('isAnonymousLogged')) {
                return $('#register-modal').modal('show');
            }
            if (!this.get('controllers.application.model.profile.isEmailConfirmed')) {
                return App.showError(App.CONFIRM_EMAIL_MESSAGE);
            }

            var doc = this.get('firstSelectedDocument');

            this.set('sendDialogActiveTab', activeTab || 'email');

            if (doc) {
                this.set(activeTab + 'Prepared', true);
                this.set('sendingDocument', doc);

                this.store.find('page', {
                        doc: doc.get('id')
                    })
                    .then(_.bind(function(pages) {
                        this.set('sendingDocumentPages', pages.toArray());
                        $('#doc-send').modal('show');
                    }, this))
                    .finally(_.bind(function() { // jshint ignore:line
                        this.set(activeTab + 'Prepared', false);
                    }, this));
            }
        },

        printDocument: function(doc) {
            if (this.get('isAnonymousLogged')) {
                return $('#register-modal').modal('show');
            }
            if (!this.get('controllers.application.model.profile.isEmailConfirmed')) {
                return App.showError(App.CONFIRM_EMAIL_MESSAGE);
            }

            if (!doc) {
                doc = this.get('firstSelectedDocument');
            }

            this.set('isPrintingPrepared', true);

            this.pdfExportService.printInBrowser(doc, this.store, _.bind(function() {
                this.set('isPrintingPrepared', false);
            }, this));
        },

        cloneDocument: function() {
            this.set('cloning', true);

            $.ajax({
                url: sprintf('/api/v1.0/users/%s/documents/%s', App.get('userId'), this.get('selectedDocuments.0.id')),
                type: 'POST',
                cache: false,
                contentType: 'application/json',
                dataType: 'json',
                context: this,
                data: JSON.stringify({
                    action: 'clone'
                }),
                success: function(data) {
                    this.store.pushPayload(data);

                    Ember.run.scheduleOnce('afterRender', this, function() {
                        this.set('areAllDocsSelected', false);
                        this.set('cloning', false);

                        this.store.find('document', data.documents[0].id).then(_.bind(function(doc) {
                            if (doc) {
                                doc.setProperties({
                                    isEditing: true,
                                    isSelected: true
                                });
                            }
                        }));
                    });
                },
                error: function(xhr) {
                    this.set('cloning', false);
                    App.showError('Failed to copy document.');
                }
            });
        },

        showFoldersToCopyDialog: function() {
            this.get('folders').forEach(function(folder) {
                folder.set('isSelectedAsDestination', false);
            });
            $('#folder-select-dialog').modal('show');
        },

        selectAsDestination: function(selectedFolder) {
            this.get('folders').forEach(function(folder) {
                folder.set('isSelectedAsDestination', false);
            });
            selectedFolder.set('isSelectedAsDestination', true);
        },

        moveDocuments: function(documentId, folderId) {
            var selectedFolder = null,
                currentFolder = this.get('activeFolder'),
                documentsToBeMoved = null;

            if (documentId && folderId) {
                selectedFolder = this.get('folders').findBy('id', folderId);
                documentsToBeMoved = this.get('pagedDocs').filterBy('id', documentId);
            } else {
                this.get('folders').forEach(function(folder) {
                    if (folder.get('isSelectedAsDestination')) {
                        selectedFolder = folder;
                        return;
                    }
                });
                documentsToBeMoved = this.get('selectedDocuments');
            }

            if (selectedFolder) {
                if (selectedFolder.get('alias') === 'trash') {
                    this.moveToTrash(documentsToBeMoved.objectAt(0));
                } else {
                    documentsToBeMoved.forEach(_.bind(function(doc) {
                        this.changeDoc(doc, function(rec) {
                            rec.get('folders').removeObject(currentFolder);
                            rec.get('folders').pushObject(selectedFolder);
                        }, function(rec) {
                            rec.get('folders').pushObject(currentFolder);
                            rec.get('folders').removeObject(selectedFolder);
                        });
                    }, this));
                    $('#folder-select-dialog').modal('hide');
                }
            }
        },

        togglePageDocsSelection: function() {
            this.set('areAllDocsSelected', !this.get('areAllDocsSelected'));
        },

        cancelSelection: function() {
            this.set('areAllDocsSelected', false);
            this.cancelSelection();
        },

        moveDocumentSelection: function(direction) {
            if (this.get('pagedDocs').length < 1) {
                return;
            }

            if (this.get('areAllDocsSelected')) {
                this.set('areAllDocsSelected', false);
            }

            var lastSelectedDocIndex = this.get('selectedDocuments.length') ? this.get('lastSelectedDocIndex') : -1,
                totalDocsOnPage = this.get('pagedDocs').length;

            this.cancelSelection();

            if (direction === 'up') {
                if (lastSelectedDocIndex === -1) {
                    //select the last document on the page
                    lastSelectedDocIndex = totalDocsOnPage - 1;
                } else if (lastSelectedDocIndex > 0) {
                    lastSelectedDocIndex--;
                }
            } else if (direction === 'down') {
                if (lastSelectedDocIndex === -1) {
                    //select the first document on the page
                    lastSelectedDocIndex = 0;
                } else if (lastSelectedDocIndex < (totalDocsOnPage - 1)) {
                    lastSelectedDocIndex++;
                }
            }

            this.get('pagedDocs').objectAt(lastSelectedDocIndex).set('isSelected', true);
            this.set('lastSelectedDocIndex', lastSelectedDocIndex);
        },

        folderRemoved: function() {
            var currentFolder = this.get('folders').findBy('alias', this.get('selectedFolderAlias'));
            //selected folder was removed - select 'My Documents'
            if (!currentFolder) {
                this.send('folderChanged', this.get('myDocumentsFolder') || this.get('folders').findBy('alias', 'sent'));
            }
        },

        uploadSampleForm: function() {
            this.set('uploadingSampleForm', true);

            $.ajax({
                url: sprintf('/api/v1.0/users/%s/documents', App.get('userId')),
                type: 'POST',
                data: JSON.stringify({
                    action: 'uploadTestFile',
                    folderId: this.get('activeFolder.id')
                }),
                cache: false,
                contentType: 'application/json',
                dataType: 'json',
                context: this,
                success: function(data) {
                    this.set('uploadingSampleForm', false);
                    App.showNotification(data.detectorMessage, true);
                },
                error: function(xhr) {
                    this.set('uploadingSampleForm', false);
                    if (xhr.status === 403) {
                        var error;
                        if (xhr.responseText) {
                            try {
                                error = JSON.parse(xhr.responseText).message;
                            } catch (e) {
                                error = 'Error: ' + xhr.responseText;
                            }
                        } else {
                            error = 'Unexpected error: ' + xhr.statusText;
                        }
                        App.showError(error);
                    } else {
                        App.showError('Failed to upload PDF.');
                    }
                }
            });
        },

        hidePromo: function(name) {
            window.clientStorage.storeValue('dash-hide-promo-' + name, Date.now());
            this.set(name, false);
        }
    },

    init: function() {
        this._super();

        var socket = App.get('socket'),
            userId = App.get('userId');

        socket.on('document.insert', _.bind(this.onDocumentInserted, this));
        socket.on('document.update', _.bind(this.onDocumentUpdated, this));
        socket.on('document.delete', _.bind(this.onDocumentDeleted, this));

        socket.on('sentItem.insert', _.bind(this.onSentItemInserted, this));
        socket.on('sentItem.update', _.bind(this.onSentItemUpdated, this));
        socket.on('sentItem.delete', _.bind(this.onSentItemDeleted, this));

        var subscriptionType = this.get('controllers.application.model.profile.subscription.type'),
            isPro = subscriptionType === 'annual' || subscriptionType === 'monthly',
            promoCloseDate = 0,
            hasPromo = false,
            PROMO_HIDE_PERIOD = 30 * 24 * 60 * 60 * 1000; // 1 month

        if (!isPro) {
            promoCloseDate = window.clientStorage.readValue('dash-hide-promo-promoPro');

            if (!promoCloseDate || +promoCloseDate < Date.now() - PROMO_HIDE_PERIOD) {
                this.set('promoPro', true);
                hasPromo = true;
            }
        }

        if (!hasPromo) {
            promoCloseDate = window.clientStorage.readValue('dash-hide-promo-promoInvite');

            if (!promoCloseDate || +promoCloseDate < Date.now() - PROMO_HIDE_PERIOD) {
                this.set('promoInvite', true);
                hasPromo = true;
            }
        }
    },

    changeDoc: function(rec, change, revert) {
        change(rec);

        var onError = _.bind(function(xhr) {
            revert(rec);
            this.showError('Error: ' + xhr.statusText + '. Please reload the page');
            Ember.onerror(xhr);
        }, this);

        rec.save().then(null, function(xhr) {
            if (xhr.status === 409) {
                rec.reload().then(function() { // reload doc to prevent conflicts
                    change(rec);
                    rec.save().then(null, onError);
                });
            } else {
                onError(xhr);
            }
        });
    },

    hideProPromo: function() {
        var subscriptionType = this.get('controllers.application.model.profile.subscription.type'),
            isPro = subscriptionType === 'annual' || subscriptionType === 'monthly';

        if (isPro) {
            this.set('promoPro', false);
        }
    }.observes('controllers.application.model.profile.subscription.type'),

    moveToTrash: function(doc) {
        var selectedDocuments = doc ? this.get('sortedDocuments').filterBy('id', doc.get('id')) : this.get('selectedDocuments');
        var trashFolder = this.store.all('folder').findBy('alias', 'trash');
        selectedDocuments.forEach(_.bind(function(doc) {
            this.changeDoc(doc, function(rec) {
                rec.set('isSelected', false);
                rec.get('folders').pushObject(trashFolder);
                trashFolder.get('documents').pushObject(rec);
            }, function(rec) {
                rec.set('isSelected', true);
                rec.get('folders').removeObject(trashFolder);
                trashFolder.get('documents').removeObject(rec);
            });
        }, this));
    },

    onDocumentNameFilterChanged: function() {
        if (this.get('documentNameFilter').length > 0) {
            //set documentNameFilterVal that is binded to inputs value
            this.set('documentNameFilterVal', this.get('documentNameFilter'));

            // filter active folder's documents using search value
            if (this.get('activeFolderDocuments')) {
                var docs = this.get('activeFolderDocuments').filter(_.bind(function(item) {
                    return (new RegExp(this.get('documentNameFilter'))).test(item.get('name')) &&
                        ((!this.get('isTrashActiveFolder') && !item.get('folders').findBy('alias', 'trash')) ||
                            (this.get('isTrashActiveFolder') && item.get('folders').findBy('alias', 'trash')));
                }, this));

                this.set('docsFilteredByName', docs);
            }
        }
    }.observes('documentNameFilter'),

    // apply filter only after typing of document name is finished
    onDocumentNameFilterValChanged: function() {
        // set documentNameFilter after typing was finished. This prevents from issue with browser 'back'/'forward' buttons
        clearTimeout(this.updateRouteTimer);
        this.updateRouteTimer = setTimeout(_.bind(function() {
            this.set('documentNameFilter', this.get('documentNameFilterVal'));
        }, this), 500);
    }.observes('documentNameFilterVal'),

    onSortersChanged: function() {
        _.forEach(this.get('sorters'), _.bind(function(sorter) {
            var sortData = sorter.split(':'),
                sortFieldData;
            if (sortData.length === 1) {
                sortFieldData = this.get('sortersData.' + sortData[0]);
                if (sortFieldData) {
                    sortFieldData.setProperties({
                        asc: true,
                        'desc': false
                    });
                }
            } else if (sortData.length === 2) {
                sortFieldData = this.get('sortersData.' + sortData[0]);
                if (sortFieldData) {
                    if (sortData[1] === 'asc') {
                        sortFieldData.setProperties({
                            asc: true,
                            'desc': false
                        });
                    } else if (sortData[1] === 'desc') {
                        sortFieldData.setProperties({
                            asc: false,
                            'desc': true
                        });
                    }
                }
            }
        }, this));
    }.observes('sorters'),

    uploadFile: function(file) {
        this.fileUploadService.uploadFile(file, {
            success: function(data) {
                App.showNotification(data.detectorMessage, true);
            },
            error: function(errorMessage) {
                App.showError(errorMessage);
            }
        });
    },

    showError: function(message) {
        App.showError(message);
    },

    sharedDocumentIsSelected: function() {
        return this.get('selectedDocuments').any(function(doc) {
            return doc.get('shared');
        });
    }.property('selectedDocuments'),

    isCloneEnabled: function() {
        return this.get('selectedDocuments').length === 1 && !this.get('cloning') && !this.get('sharedDocumentIsSelected');
    }.property('selectedDocuments', 'cloning'),

    isDeleteBtnEnabled: function() {
        return this.get('selectedDocuments').length > 0 && !this.get('sharedDocumentIsSelected');
    }.property('selectedDocuments'),

    isRenameBtnEnabled: function() {
        return this.get('selectedDocuments').length === 1 && !this.get('sharedDocumentIsSelected');
    }.property('selectedDocuments'),

    isDownloadBtnEnabled: function() {
        return (this.get('selectedDocuments').length === 1) && !this.get('isDownloadPrepared');
    }.property('selectedDocuments', 'isDownloadPrepared'),

    isEmailingBtnEnabled: function() {
        var selectedDocuments = this.get('selectedDocuments');
        return (selectedDocuments.length === 1);
    }.property('selectedDocuments'),

    isPrintingBtnEnabled: function() {
        return (this.get('selectedDocuments').length === 1) && !this.get('isPrintingPrepared');
    }.property('selectedDocuments', 'isPrintingPrepared'),

    isRestoreBtnVisible: function() {
        return this.get('selectedDocuments').length > 0 && this.get('isTrashActiveFolder');
    }.property('isTrashActiveFolder', 'selectedDocuments'),

    isShowFoldersToCopyDialogBtnEnabled: function() {
        return this.get('selectedDocuments').length > 0 && !this.get('sharedDocumentIsSelected');
    }.property('selectedDocuments'),

    isMoveButtonDisabled: function() {
        return !(this.get('folders').findBy('isSelectedAsDestination', true));
    }.property('folders.@each.isSelectedAsDestination'),

    selectedDocuments: function() {
        return this.get('pagedDocs').filter(function(doc) {
            return doc.get('isSelected');
        });
    }.property('pagedDocs.@each.isSelected'),

    firstSelectedDocument: function() {
        return this.get('pagedDocs').findBy('isSelected', true);
    }.property('pagedDocs.@each.isSelected'),

    destinationFoldersListEmpty: function() {
        var count = 0;
        this.get('folders').forEach(function(folder) {
            //trash and currently active folder cannot be used as destination
            if (!folder.get('isTrash') && !folder.get('isActive')) {
                count++;
            }
        });
        return (count === 0);
    }.property('folders.@each.isActive'),


    areAllDocsSelectedChanged: function() {
        var areAllDocsSelected = this.get('areAllDocsSelected');
        this.get('pagedDocs').forEach(function(doc) {
            doc.set('isSelected', areAllDocsSelected);
        });
    }.observes('areAllDocsSelected'),

    cancelSelection: function() {
        this.get('pagedDocs').forEach(function(doc) {
            doc.set('isSelected', false);
        });
    },

    onSentItemInserted: function(data) {
        this.store.pushPayload({
            sentItems: [data.data]
        });
    },

    onSentItemUpdated: function(data) {
        this.store.find('sentItem', data.id).then(function(rec) {
            rec.reload();
        });
    },

    onSentItemDeleted: function(data) {
        this.store.find('sentItem', data.id).then(function(rec) {
            if (rec) {
                rec.unloadRecord();
            }
        });
    },

    onDocumentInserted: function(data) {
        this.store.pushPayload({
            documents: [data.data]
        });

        this.store.find('document', data.id).then(_.bind(function(doc) {
            // cache PDF for the Edit page
            if (App.get('isNotMobileDevice')) {
                this.pdfJsLoaderService.load(function() {
                    PDFJS.getDocument(doc.get('fileUrl'));
                }, this);
            }
        }, this));
    },

    onDocumentUpdated: function(data) {
        if (data.clientId !== App.get('clientId')) {
            this.store.find('document', data.id).then(_.bind(function(doc) {
                if (doc) {
                    var folders = data.data.folders,
                        removed = false, // have to track deleted folders, because when Trash folder is remved from the doc, it indirectly affects other folders
                        docFolders = doc.get('folders'),
                        i,
                        folder,
                        addFolder = function(store, folderId, doc) {
                            store.find('folder', folderId).then(function(folder) {
                                folder.get('documents').pushObject(doc);
                            });
                        };

                    for (i = 0; i < folders.length; i++) {
                        if (!docFolders.findBy('id', folders[i])) {
                            addFolder(this.store, folders[i], doc);
                        }
                    }

                    for (i = 0; i < docFolders.get('length'); i++) {
                        folder = docFolders.objectAt(i);

                        if (folders.indexOf(folder.get('id')) === -1) {
                            docFolders.removeAt(i--);
                            removed = true;
                        }
                    }

                    delete data.data.folders;
                    data.data.createdAt = new Date(data.data.createdAt);
                    data.data.updatedAt = new Date(data.data.updatedAt);
                    data.data.compositeUpdatedAt = new Date(data.data.compositeUpdatedAt);

                    doc.setProperties(data.data);

                    if (removed) {
                        // hack to trigger folder update, when doc is removed from the Trash
                        // in this case folder is updated indirectly
                        var documentPerPageCnt = this.get('documentPerPageCnt');
                        this.set('documentPerPageCnt', 0);
                        this.set('documentPerPageCnt', documentPerPageCnt);
                    }
                }
            }, this));
        }
    },

    onDocumentDeleted: function(data) {
        if (data.clientId !== App.get('clientId')) {
            this.store.find('document', data.id).then(function(rec) {
                if (rec) {
                    rec.unloadRecord();
                }
            });
        }
    },

    goProQueryParamChanged: function() {
        if (this.get('goProQueryParam') == 'true') {
            Ember.run.scheduleOnce('afterRender', this, function() {
                $('#subscription-modal').modal('show').on('shown.bs.modal', _.bind(function() {
                    this.set('goProQueryParam', '');
                }, this));
            });
        }
    }.observes('goProQueryParam'),

    inviteQueryParamChanged: function() {
        if (this.get('inviteQueryParam') == 'true') {
            Ember.run.scheduleOnce('afterRender', this, function() {
                $('#referrals-modal').modal('show').on('shown.bs.modal', _.bind(function(e) {
                    this.set('inviteQueryParam', '');
                }, this));
            });
        }
    }.observes('inviteQueryParam'),

    updateActiveFolder: function() {
        this.set('fileUploadService.activeFolderId', this.get('activeFolder.id'));
    }.observes('activeFolder')
});
