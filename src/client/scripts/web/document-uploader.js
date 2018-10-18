/*global io*/
// TODO: use the same code for ember app and static pages
var DocumentUploader = (function() {
    /**
     * @constructor
     */
    function DocumentUploader() {}

    /**
     * Show modal that proposes to login or to try paperjet. Binds DOM events listeners fpr this modal
     *
     * @param droppedFile
     * @param options - options passed to the uploadFile function
     */
    DocumentUploader.prototype.showLoginModal = function(uploadType, uploadInput, options) {
        var me = this,
            loginModal = $('#login-or-try-modal'),
            showLoginFormBtn = loginModal.find('.show-login-form-btn'),
            tryPaperjetBtn = loginModal.find('.try-paperjet-btn'),
            loginForm = loginModal.find('.login-form'),
            loginFormPanel = loginModal.find('.login-form-panel'),
            signInBtn = loginForm.find('.login-btn'),
            usernameField = loginForm.find('input[name="email"]'),
            passwordField = loginForm.find('input[name="password"]'),
            login = function(data) {
                $.ajax({
                    url: '/api/v1.0/connection',
                    data: data,
                    type: 'post',
                    dataType: 'json',
                    success: function(user) {
                        loginModal.modal('hide');

                        App.set('userId', user._id);
                        if ((uploadType === 'fileUpload') || (uploadType === 'dndUpload')) {
                            me.uploadFile(uploadInput, options);
                        } else if (uploadType === 'urlUpload') {
                            me.uploadUrl(uploadInput, options);
                        }
                    },
                    error: function(jqXHR) {
                        App.showError(me.extractErrorMessage(jqXHR));
                    }
                });
            };

        showLoginFormBtn.unbind('click').unbind('click').click(function() {
            loginFormPanel.slideDown();
        });

        signInBtn.unbind('click').click(function() {

            login({
                username: usernameField.val(),
                password: passwordField.val(),
                action: 'login'
            });
        });

        tryPaperjetBtn.unbind('click').click(function() {
            login({
                action: 'register-anonymous'
            });
        });

        $(loginModal).modal('show');
    };

    /**
     * Initializes area that can accept dropped document
     *
     * @param options
     */
    DocumentUploader.prototype.initDragAndDrop = function(options) {
        jQuery.event.props.push('dataTransfer');

        var el = options.target,
            appendHoverClassTo = options.appendHoverClassTo || [],
            dragLeaveTimer = null,
            showFullScreenDropIndicators = function() {
                if (options && options.isFullscreen) {
                    if (!$('.external-drop-indicator').length) {
                        $('<div class="external-drop-indicator top"></div>').appendTo('body');

                        if (App.get('userId')) {
                            $('<div class="external-drop-indicator help"><div>Drop file to upload into your account</div></div>').appendTo('body');
                        } else {
                            $('<div class="external-drop-indicator help"><div>Drop file to try Paperjet</div></div>').appendTo('body');
                        }
                        $('<div class="external-drop-indicator bottom"></div>').appendTo('body');
                        $('<div class="external-drop-indicator left"></div>').appendTo('body');
                        $('<div class="external-drop-indicator right"></div>').appendTo('body');
                    }
                    $('.external-drop-indicator').fadeIn();
                }
            },
            hideFullScreenDropIndicators = function() {
                if (options && options.isFullscreen) {
                    $('.external-drop-indicator').fadeOut();
                }
            };

        appendHoverClassTo.push(options.target);

        el.on('dragover', function(evt) {
            clearTimeout(dragLeaveTimer);
            $.each(appendHoverClassTo, function(index, curTarget) {
                curTarget.addClass('file-hover');
            });
            showFullScreenDropIndicators();
            evt.dataTransfer.dropEffect = 'copy';
            return false;
        });

        el.on('dragleave', function() {
            dragLeaveTimer = setTimeout(function() {
                $.each(appendHoverClassTo, function(index, curTarget) {
                    curTarget.removeClass('file-hover');
                });
                hideFullScreenDropIndicators();
            }, 500);

            return false;
        });

        el.on('drop', _.bind(function(e) {
            $.each(appendHoverClassTo, function(index, curTarget) {
                curTarget.removeClass('file-hover');
            });
            hideFullScreenDropIndicators();

            e.preventDefault();
            e.stopPropagation();

            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                if (App.get('userId')) {
                    this.uploadFile(e.dataTransfer.files[0], options);
                } else {
                    this.showLoginModal('dndUpload', e.dataTransfer.files[0], options);
                }
            }
        }, this));
    };

    /**
     * Initializes regular file uploading (via file select dialog)
     *
     * @param options [hash]
     *  - target        input with type=file jQuery object
     *  - success       fires when uploading is finished successfully
     */
    DocumentUploader.prototype.initFileUploader = function(options) {
        $(options.target).on('change.bs.fileinput', _.bind(function() {
            var input = options.target;
            if (input && input.length && input[0].files && input[0].files.length) {
                if (App.get('userId')) {
                    this.uploadFile(input[0].files[0], options);
                } else {
                    this.showLoginModal('fileUpload', input[0].files[0], options);
                }
            }
        }, this));
    };

    /**
     * Initializes document uploading from URL
     *
     * @param options
     */
    DocumentUploader.prototype.initUrlUploader = function(options) {
        var me = this;
        $(options.target).submit(function(e) {

            e.preventDefault();
            var url = $(options.target).find('input[name=url]').val();
            url = url.trim();
            if (url.length === 0) {
                App.showError('Please enter a URL');
                return;
            }
            if (!/^(https?|ftp):\/\//i.test(url)) {
                url = 'http://' + url;
                $(options.target).find('input[name=url]').val(url);
            }
            if (/^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(url)) {
                if (App.get('userId')) {
                    me.uploadUrl(url, options);
                } else {
                    me.showLoginModal('urlUpload', url, options);
                }
            } else {
                App.showError('Please enter a valid URL');
            }
        });
    };


    DocumentUploader.prototype.uploadFile = function(file, options) {
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
            allowedDocumentExts = _.values(allowedDocumentFormats),
            updateProgress = function(evt) {
                if (evt.lengthComputable) {
                    var percentsCompleted = (evt.loaded / evt.total) * 100;
                    App.showProgress('Uploading your document...', percentsCompleted);
                } else {
                    // Unable to compute progress information since the total size is unknown
                }
            };

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
                App.showError('File format is not supported. Supported formats: ' + allowedDocumentExts.join(', '));
                options.setUploading(false);
                return;
            }
        }

        App.showNotification('<i class="fa fa-refresh fa-spin"></i> Document is being uploaded. Please wait...');

        var formData = new FormData();
        formData.append('action', 'uploadFile');
        formData.append('doc', file);
        options.setUploading(true);

        $.ajax({
            url: '/api/v1.0/users/' + App.get('userId') + '/documents',
            type: 'POST',
            data: formData,
            cache: false,
            dataType: 'json',
            context: this,
            processData: false, // Don't process the files
            contentType: false, // Set content type to false as jQuery will tell the server its a query string request
            success: options.success,
            xhr: function() { // custom xhr
                var myXhr = $.ajaxSettings.xhr();
                if (myXhr.upload) { // check if upload property exists
                    myXhr.upload.addEventListener('progress', updateProgress, false);
                }
                return myXhr;
            },
            error: options.error,
            complete: function() {
                options.setUploading(false);
                if (options.complete) {
                    options.complete();
                }
            }
        });
    };

    DocumentUploader.prototype.uploadUrl = function(url, options) {
        App.showNotification('<i class="fa fa-refresh fa-spin"></i> Document is being uploaded. Please wait...');
        $.ajax({
            url: '/api/v1.0/users/' + App.get('userId') + '/documents',
            type: 'POST',
            data: {
                action: 'uploadUrl',
                url: url
            },
            dataType: 'json',
            success: options.success,
            error: options.error,
            complete: function() {
                if (options.complete) {
                    options.complete();
                }
            }
        });
    };

    DocumentUploader.prototype.extractErrorMessage = function(xhr) {
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

        return error;
    };

    return DocumentUploader;
})();

$(document).ready(function() {
    var documentUploader = new DocumentUploader(),
        showError = function(xhr) {
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
                App.showError('Unable to upload documents');
            }
        },
        onDocumentUploaded = function(response) {
            location.href = '/document/' + response.document._id;
        };

    documentUploader.initDragAndDrop({
        target: $('body'),
        isFullscreen: true,
        success: onDocumentUploaded,
        error: showError
    });

    documentUploader.initDragAndDrop({
        target: $('#drag-tab'),
        appendHoverClassTo: [$('.uploads-nav [href=#drag-tab]').closest('li')],
        isFullscreen: false,
        success: onDocumentUploaded,
        error: showError
    });

    $('.js-doc-upload-selector').each(function() {
        documentUploader.initFileUploader({
            target: $(this),
            success: onDocumentUploaded,
            error: showError
        });
    });

    documentUploader.initUrlUploader({
        target: $('form#doc-url-upload'),
        success: onDocumentUploaded,
        error: showError
    });

    var socket = io();
    socket.on('connect', function(client) {
        socket.on('document.conversion.start', function() {
            App.showNotification('Converting...');
        });
    });
});
