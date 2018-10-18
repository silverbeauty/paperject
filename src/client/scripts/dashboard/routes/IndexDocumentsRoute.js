App.IndexDocumentsRoute = Ember.Route.extend({
    needs: ['application'],
    promise: null,

    queryParams: {
        name: {
            refreshModel: true
        },
        folder: {
            refreshModel: true
        }
    },

    model: function(params) {
        if (App.testing) {
            return [];
        }
        if (!this.promise) {
            this.promise = new Ember.RSVP.Promise(_.bind(function(resolve, reject) {
                if (App.testing) {
                    resolve([]);
                    return;
                }

                var query = {};

                _.each(params, function(value, name) {
                    if (value !== '') {
                        query[name] = value;
                    }
                });

                //get default's folder documents
                this.store.find('document', query).then(_.bind(function(documents) {
                    var folders = this.store.all('folder'),
                        folderName,
                        activeFolder,
                        myDocumentsFolder = folders.findBy('alias', 'my-documents');

                    if (params.selectedFolderAlias) {
                        folderName = params.selectedFolderAlias.toLowerCase();
                    } else {
                        if (myDocumentsFolder) {
                            folderName = 'my-documents';
                        } else {
                            folderName = 'sent'; // see config.myDocumentsNotAvailable on the backend
                        }
                    }

                    activeFolder = folders.findBy('alias', folderName);

                    if (folderName !== 'sent' && !activeFolder) {
                        activeFolder = myDocumentsFolder;
                    }

                    if (activeFolder) {
                        activeFolder.set('isActive', true);
                    }

                    resolve({
                        folderName: folderName || '',
                        activeFolder: activeFolder,
                        myDocumentsFolder: myDocumentsFolder,
                        folders: folders
                    });
                }, this));

            }, this));
        }

        return this.promise;
    },

    setupController: function(controller, models) {
        controller.set('sentItems', this.store.all('sentItem'));
        controller.set('folders', models.folders);
        controller.set('activeFolder', models.activeFolder);
        controller.set('activeFolderDocuments', models.activeFolder ? models.activeFolder.get('documents') : []);
        controller.set('docsFilteredByName', models.activeFolder ? models.activeFolder.get('documents') : []);
        controller.set('myDocumentsFolder', models.myDocumentsFolder);
        controller.set('showSentDocuments', models.folderName === 'sent');
    }
});
