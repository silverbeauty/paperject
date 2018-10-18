'use strict';

/*global Ladda*/
App.UploadModalComponent = Ember.Component.extend({
    activeFolderId: '',
    googleAccessToken: '',
    selectedGoogleDriveFile: null,
    uploadErrorMessage: '',
    uploading: false,
    uploadedFile: null,
    visible: false,
    store: null,

    actions: {
        dismissUploadErrorMessage: function() {
            this.set('uploadErrorMessage', '');
        },

        upload: function() {
            this.set('uploadErrorMessage', '');
            this.uploadGoogleFile();
        }
    },

    didInsertElement: function() {
        var spinner = Ladda.create($('#upload-modal-upload')[0]);

        this.addObserver('uploading', this, function() {
            if (this.get('uploading')) {
                spinner.start();
            } else {
                spinner.stop();
            }
        });

        $('#upload-modal')
            .on('shown.bs.modal', _.bind(function() {
                this.set('visible', true);
            }, this))
            .on('hidden.bs.modal', _.bind(function() {
                this.set('selectedGoogleDriveFile', null);
                this.set('visible', false);
            }, this));
    },

    uploadDisabled: function() {
        return this.get('uploading') || !this.get('googleAccessToken') || !this.get('selectedGoogleDriveFile');
    }.property('uploading', 'googleAccessToken', 'selectedGoogleDriveFile'),

    uploadGoogleFile: function() {
        App.clearNotificationMessage();
        this.set('uploading', true);
        $.ajax({
            url: sprintf('/api/v1.0/users/%s/documents', App.get('userId')),
            type: 'POST',
            data: JSON.stringify({
                action: 'uploadGoogleDriveFile',
                accessToken: this.googleAccessToken,
                folderId: this.get('activeFolderId'),
                fileName: this.selectedGoogleDriveFile.get('title'),
                url: this.selectedGoogleDriveFile.get('downloadUrl'),
                mimeType: this.selectedGoogleDriveFile.get('mimeType'),
                fileSize: this.selectedGoogleDriveFile.get('fileSize')
            }),
            contentType: 'application/json',
            cache: false,
            dataType: 'json',
            context: this,
            processData: false, // Don't process the files
            success: this.documentUploaded,
            error: this.uploadError,
            complete: this.uploadCompleted
        });
    },

    documentUploaded: function(data) {
        $('#upload-modal').modal('hide');
        App.showNotification(data.detectorMessage, true);
    },

    uploadError: function(xhr) {
        var message = 'Failed to upload file';

        if (xhr.responseText) {
            try {
                message = JSON.parse(xhr.responseText).message;
            } catch (ignore) {}
        }

        this.set('uploadErrorMessage', message);
    },

    uploadCompleted: function() {
        this.set('uploading', false);
    }
});
