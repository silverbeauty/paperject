/*global gapi*/
App.GoogleDriveComponent = Ember.Component.extend({
    classNames: ['google-drive'],

    selectedNode: null,
    selectedFile: null,
    accessToken: '',
    visible: false,

    root: Ember.Object.create({
        text: 'My Drive',
        id: 'root',
        dataLoaded: false,
        dataLoading: false,
        children: Ember.ArrayProxy.create({
            content: Ember.A([])
        }),
        files: Ember.ArrayProxy.create({
            content: Ember.A([])
        })
    }),

    actions: {
        selectFile: function(file) {
            if (file.get('downloadUrl')) {
                this.set('selectedFile', file);
            }
        }
    },

    selectedFileBeforeChange: function() {
        if (this.get('selectedFile')) {
            this.set('selectedFile.selected', false);
        }
    }.observesBefore('selectedFile'),

    selectedFileChange: function() {
        if (this.get('selectedFile')) {
            this.set('selectedFile.selected', true);
        }
    }.observes('selectedFile'),

    selectedNodeChange: function() {
        this.set('selectedFile', null);
    }.observes('selectedNode'),

    expand: function(node) {
        node.set('dataLoading', true);
        this.loadNode(node);
    },

    loadGoogleClient: function() {
        if (this.get('visible') && !this.get('accessToken')) {
            $.getScript('https://apis.google.com/js/client.js', _.bind(function() {
                var self = this,
                    googleClientId = $('meta[name="google-client-id"]').attr('content'),
                    retries = 0;

                var handleAuthResult = function(authResult) {
                        if (authResult && !authResult.error) {
                            self.set('accessToken', authResult.access_token);
                            // Access token has been successfully retrieved, requests can be sent to the API.
                            gapi.client.load('drive', 'v2', function() {
                                self.clientLoaded = true;
                                self.expand(self.root);
                            });
                        } else {
                            gapi.auth.authorize({
                                    'client_id': googleClientId,
                                    'scope': [
                                        'https://www.googleapis.com/auth/drive',
                                        'https://www.googleapis.com/auth/drive.apps.readonly'
                                    ],
                                    'immediate': false
                                },
                                handleAuthResult);
                        }
                    },
                    authorize = function() {
                        if (gapi.auth) {
                            gapi.auth.authorize({
                                    'client_id': googleClientId,
                                    'scope': [
                                        'https://www.googleapis.com/auth/drive',
                                        'https://www.googleapis.com/auth/drive.apps.readonly'
                                    ],
                                    'immediate': true
                                },
                                handleAuthResult);
                        } else {
                            setTimeout(authorize, 500 * ++retries);
                        }
                    };

                authorize();
            }, this));
        }
    }.observes('visible'),

    loadNode: function(node) {
        var self = this,
            query = "'" + node.id + "' in parents and trashed=false",
            fields = 'items(createdDate,description,fileExtension,fileSize,iconLink,id,imageMediaMetadata,indexableText,mimeType,thumbnailLink,title,webContentLink,defaultOpenWithLink,downloadUrl)', // TODO: remove unneeded
            initialRequest = gapi.client.drive.files.list({
                q: query,
                fields: fields
            }),
            retrievePageOfFiles = function(request, result) {
                request.execute(function(resp) {
                    if (resp) {
                        result = result.concat(resp.items);
                        var nextPageToken = resp.nextPageToken;
                        if (nextPageToken) {
                            request = gapi.client.drive.files.list({
                                'pageToken': nextPageToken
                            });
                            retrievePageOfFiles(request, result);
                        } else {
                            self.nodeLoaded(node, result);
                        }
                    } else {
                        self.nodeLoaded(node, result);
                    }
                });
            };

        retrievePageOfFiles(initialRequest, []);
    },

    nodeLoaded: function(node, data) {
        var folders = [],
            files = [],
            fileSize = 0,
            title;

        for (var i = 0; i < data.length; i++) {
            if (data[i].mimeType === 'application/vnd.google-apps.folder') {
                folders.push(Ember.Object.create({
                    id: data[i].id,
                    text: data[i].title,
                    dataLoaded: false,
                    dataLoading: false,
                    children: Ember.ArrayProxy.create({
                        content: Ember.A([])
                    }),
                    files: Ember.ArrayProxy.create({
                        content: Ember.A([])
                    })
                }));
            } else {
                fileSize = data[i].fileSize || 0;
                title = data[i].title;

                if (fileSize > 100 * 1024 * 1024) {
                    title += ' (file size exceed 100Mb limit)';
                }

                files.push(Ember.Object.create({
                    selected: false,
                    selectable: !!data[i].downloadUrl && fileSize < 100 * 1024 * 1024, // 100Mb
                    id: data[i].id,
                    mimeType: data[i].mimeType,
                    title: title,
                    parentId: node.id,
                    fileSize: data[i].fileSize,
                    webContentLink: data[i].webContentLink,
                    downloadUrl: data[i].downloadUrl,
                    iconLink: data[i].iconLink,
                    defaultOpenWithLink: data[i].defaultOpenWithLink
                }));
            }
        }

        node.children.pushObjects(folders);
        node.files.pushObjects(files);
        node.set('dataLoading', false);
        node.set('dataLoaded', true);
    }
});
