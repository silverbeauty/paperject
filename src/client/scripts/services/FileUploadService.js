App.FileUploadService = Ember.Object.extend({
    activeFolderId: '',

    createDropZone: function(options) {
        var el = options.target,
            dragLeaveTimer = null,
            showFullscreenDropIndicators = function() {
                if (options && options.isFullscreen) {
                    if (!$('.external-drop-indicator').length) {
                        $('<div class="external-drop-indicator top"></div>').appendTo('body');
                        $('<div class="external-drop-indicator help"><div>Drop your file on the page to upload</div></div>').appendTo('body');
                        $('<div class="external-drop-indicator bottom"></div>').appendTo('body');
                        $('<div class="external-drop-indicator left"></div>').appendTo('body');
                        $('<div class="external-drop-indicator right"></div>').appendTo('body');
                    }
                    $('.external-drop-indicator').fadeIn();
                }
            },
            hideFullscreenDropIndicators = function() {
                if (options && options.isFullscreen) {
                    $('.external-drop-indicator').fadeOut();
                }
            };

        el.on('dragover', function(evt) {
            var dt = evt.originalEvent.dataTransfer;
            if (dt.types != null && (dt.types.indexOf ? dt.types.indexOf('Files') != -1 : dt.types.contains('application/x-moz-file'))) {
                clearTimeout(dragLeaveTimer);
                el.addClass('file-hover');
                showFullscreenDropIndicators();
                evt.dataTransfer.dropEffect = 'copy';
                return false;
            }
        });

        el.on('dragleave', function() {
            dragLeaveTimer = setTimeout(function() {
                el.removeClass('file-hover');
                hideFullscreenDropIndicators();
            }, 500);

            return false;
        });

        el.on('drop', _.bind(function(e, ui) {
            if (ui) {
                return true;
            }
            el.removeClass('file-hover');
            hideFullscreenDropIndicators();

            e.preventDefault();
            e.stopPropagation();

            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                this.uploadFile(e.dataTransfer.files[0], options);
            }
        }, this));
    },

    uploadFile: function(file, options) {
        var allowedDocumentFormats = {
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                'application/msword': 'doc',
                'application/vnd.oasis.opendocument.text': 'odt',
                'application/rtf': 'rtf',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
                'application/vnd.ms-powerpoint': 'ppt',
                'image/gif': 'gif',
                'image/jpeg': 'jpeg, jpg',
                'image/bmp': 'bmp',
                'image/tiff': 'tiff',
                'image/png': 'png',
                'application/pdf': 'pdf'
            },
            allowedDocumentTypes = _.keys(allowedDocumentFormats),
            allowedDocumentExts = _.values(allowedDocumentFormats);

        if (!file) {
            return;
        }

        if (!options.setUploading) {
            options.setUploading = function() {};
        }

        if (allowedDocumentTypes.indexOf(file.type.toLowerCase()) === -1) {
            // file.type is not available in IE, so fallback to extension
            var ext = file.name.substr((Math.max(0, file.name.lastIndexOf(".")) || Infinity) + 1).toLowerCase();
            if (allowedDocumentExts.indexOf(ext) === -1) {
                App.showError('File format is not supported. Supported formats: ' + allowedDocumentExts.join(', ') + '.');
                options.setUploading(false);
                return;
            }
        }

        var formData = new FormData(),
            updateProgress = function(evt) {
                if (evt.lengthComputable) {
                    var percentComplete = (evt.loaded / evt.total) * 100;
                    App.showProgress('Uploading your document...', percentComplete);
                } else {
                    // Unable to compute progress information since the total size is unknown
                }
            };

        formData.append('action', 'uploadFile');

        if (this.get('activeFolderId')) {
            formData.append('folderId', this.get('activeFolderId'));
        }

        if (!App.get('enableFfd')) {
            formData.append('enableFfd', false);
        }

        formData.append('doc', file);
        options.setUploading(true);

        $.ajax({
            url: sprintf('/api/v1.0/users/%s/documents', App.get('userId')),
            type: 'POST',
            data: formData,
            cache: false,
            dataType: 'json',
            context: this,
            processData: false, // Don't process the files
            contentType: false, // Set content type to false as jQuery will tell the server its a query string request
            success: options.success,
            error: function(xhr) {
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
                    if (options.error) {
                        options.error(error);
                    }
                } else {
                    options.error('Unable to upload documents');
                }
            },
            xhr: function() { // custom xhr
                var myXhr = $.ajaxSettings.xhr();
                if (myXhr.upload) { // check if upload property exists
                    myXhr.upload.addEventListener('progress', updateProgress, false);
                }
                return myXhr;
            },
            complete: function() {
                options.setUploading(false);
                if (options.complete) {
                    options.complete();
                }
            }
        });
    }
});
