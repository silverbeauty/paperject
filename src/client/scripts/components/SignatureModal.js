'use strict';

/*global RealisticPen,Ladda*/
App.SignatureModalComponent = Ember.Component.extend({
    DEFAULT_TAB: 'draw',
    CANVAS_PADDING_LEFT: 10,
    isFontSelectorInitialized: false,
    activeTab: '', // draw | type | upload | dragndrop | camera
    saving: false,
    errorMessage: '',
    isInitials: false,
    realisticPen: null,
    video: null,
    videoRequested: false,
    videoStarted: true,
    awaitingSignaturePreview: false,
    signaturePreview: null,

    clientOnly: false, // if true, disable all features that require server-side interaction

    currentFont: 'HaloHandletter',
    signatureText: '',
    prevFontSize: 70,
    signatureColor: '',

    signaturePreviewMargin: function() {
        var rec = this.get('signaturePreview'),
            margin = 0;

        if (rec && rec.get('h') < 256) {
            margin = (256 - rec.get('h')) / 2;
        }

        return ('margin-top:' + margin + 'px').htmlSafe();
    }.property('signaturePreview'),

    actions: {
        dismissErrorMessage: function() {
            this.set('errorMessage', '');
        },

        discardCapture: function() {
            this.discardSignaturePreview();
        },

        useCapture: function() {
            if (this.get('clientOnly')) {
                var rec = this.get('signaturePreview');

                this.sendAction('addFormSignature', {
                    img: rec.get('img'),
                    h: rec.get('h'),
                    w: rec.get('w')
                });
            } else {
                this.sendAction('selectSignature', this.get('signaturePreview'));
            }

            this.set('signaturePreview', null);
            $('#signature-modal').modal('hide');
        },

        captureFromCamera: function() {
            var canvas = $('#signature-modal-tab-camera canvas')[0],
                video = $('#signature-modal-tab-camera video')[0];

            canvas.getContext('2d').drawImage(video, 0, 0, 640, 480);
            this.captureSignatureToFfd();
        },

        setColor: function(colorName) {
            this.setColorPickerValue(colorName);
            this.set('signatureColor', this.getColorPickerValue());
        },

        clearActiveTab: function() {
            this.clear(this.get('activeTab'));
        },

        initializeFontSelector: function() {
            $.getScript('//ajax.googleapis.com/ajax/libs/webfont/1.4.7/webfont.js', _.bind(function() {
                $('#signature-modal-font-selector').fontselect({
                    style: 'sm-type-signature-font-selector toolbar-control',
                    placeholder: 'Select a font <i class="fa fa-sort-desc"></i>',
                    lookahead: 1,
                    fonts: [
                        'HaloHandletter',
                        'Annie+Use+Your+Telescope',
                        'Calligraffitti',
                        'Allan',
                        'Architects+Daughter',
                        'Cantarell',
                        'Covered+By+Your+Grace',
                        'Crafty+Girls',
                        'Damion',
                        'Dancing+Script',
                        'Dawning+of+a+New+Day',
                        'Give+You+Glory',
                        'Homemade+Apple',
                        'Indie+Flower',
                        'Just+Me+Again+Down+Here',
                        'Kristi',
                        'La+Belle+Aurore',
                        'League+Script',
                        'Lobster Two',
                        'Loved+by+the+King',
                        'Meddon',
                        'Mountains of Christmas',
                        'Nova+Script',
                        'Over+the+Rainbow',
                        'Reenie+Beanie',
                        'Pacifico',
                        'Redressed',
                        'Rock+Salt',
                        'Schoolbell',
                        'Shadows+Into+Light',
                        'Sue+Ellen+Francisco',
                        'Sunshiney',
                        'Swanky+and+Moo+Moo',
                        'Tangerine',
                        'The+Girl+Next+Door',
                        'Vibur',
                        'Waiting+for+the+Sunrise',
                        'Zeyada'
                    ]
                }).change(_.bind(function() {
                    var font = $('#signature-modal-font-selector').val().replace(/\+/g, ' ');
                    this.set('currentFont', font);
                }, this));

                $('.font-selector-initializer').hide();
                this.set('isFontSelectorInitialized', true);
                $('.sm-type-signature-font-selector div b').click();
            }, this));
        },

        saveSignature: function() {
            this.saveCanvas($('#sm-sign-save-btn'));
        },

        saveAndUseSignature: function() {
            this.saveCanvas($('#sm-sign-save-and-use-btn'), true);
        }
    },

    activeCanvas: function() {
        switch (this.get('activeTab')) {
            case 'draw':
                return $('#signature-modal-tab-draw canvas');
            case 'type':
                return $('#signature-modal-tab-type canvas');
            case 'camera':
                return $('#signature-modal-tab-camera canvas');
        }

        return null;
    }.property('activeTab'),

    isDrawOrTypeSigTabActive: function() {
        return this.get('activeTab') === 'draw' || this.get('activeTab') === 'type';
    }.property('activeTab'),

    signatureTextPlaceholder: function() {
        return this.get('isInitials') ? 'Type Initials' : 'Type Signature';
    }.property('isInitials'),

    signatureType: function() {
        return this.get('isInitials') ? 'initials' : 'signature';
    }.property('isInitials'),

    isNotMobileDevice: function() {
        return App.get('isNotMobileDevice');
    }.property('App.isNotMobileDevice'),

    cameraTabActive: Ember.computed.equal('activeTab', 'camera'),

    init: function() {
        this._super();

        this.get('targetObject').on('show-signature-modal', this, function(clientOnly) {
            this.set('isInitials', false);
            this.set('clientOnly', clientOnly);
            $('#signature-modal').modal({
                show: true,
                backdrop: 'static'
            });
        });

        this.get('targetObject').on('show-initials-modal', this, function(clientOnly) {
            this.set('isInitials', true);
            this.set('clientOnly', clientOnly);
            $('#signature-modal').modal({
                show: true,
                backdrop: 'static'
            });
        });
    },

    didInsertElement: function() {
        this._super();

        var drawCanvas = $('#signature-modal-tab-draw canvas'),
            realisticPen = new RealisticPen(drawCanvas[0], {
                penColor: this.get('signatureColor'),
                brushSize: 1
            });
        this.set('realisticPen', realisticPen);

        $('#signature-modal').on('show.bs.modal', _.bind(function() {
            Ember.run(this, function() {
                $('#signature-modal .nav-tabs a[data-tab=' + this.DEFAULT_TAB + ']').tab('show');
                this.set('activeTab', this.DEFAULT_TAB);
                this.set('signatureColor', this.getColorPickerValue());
                this.clear();
            });
        }, this));

        $('#signature-modal').on('shown.bs.modal', _.bind(function() {
            Ember.run(this, function() {
                this.resizeActiveCanvas();
                this.focusInput();
            });
        }, this));

        $('#signature-modal .nav-tabs').on('shown.bs.tab', _.bind(function(e) {
            Ember.run(this, function() {
                this.set('activeTab', $(e.target).attr('data-tab'));
                this.resizeActiveCanvas();
                this.set('signatureColor', this.getColorPickerValue());

                if (this.get('activeTab') === 'camera') {
                    this.startVideo();
                } else {
                    this.discardSignaturePreview();
                    this.stopVideo();
                }

                if ((this.get('activeTab') === 'draw' || this.get('activeTab') === 'type') && !App.get('isNotMobileDevice')) {
                    Ember.run.scheduleOnce('afterRender', this, function() {
                        $('#sm-sign-save-and-use-btn').on('touchend', _.bind(function(e) {
                            this.saveCanvas($('#sm-sign-save-and-use-btn'), true);
                            e.preventDefault();
                            e.stopPropagation();
                        }, this));
                    });
                }
            });
        }, this));

        $('#signature-modal').on('hidden.bs.modal', _.bind(function(e) {
            Ember.run(this, function() {
                this.set('errorMessage', '');
                $('.js-sign-upload-selector').val('');
                this.clear();
                this.stopVideo();

                if (this.get('signaturePreview')) {
                    if (this.get('signaturePreview').destroyRecord) {
                        this.get('signaturePreview').destroyRecord();
                    }

                    this.set('signaturePreview', null);
                }
            });
        }, this));

        this.createDropZone();

        $('.js-sign-upload-selector').on('change.bs.fileinput', _.bind(function(e) {
            var input = $(e.target);

            if (input && input.length && input[0].files && input[0].files.length) {
                this.saveFile(input[0].files[0]);
            }
        }, this));
    },

    cameraSupported: function() {
        return navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    }.property(),

    startVideo: function() {
        this.set('videoStarted', true);

        if (!this.get('videoRequested')) {
            this.set('videoRequested', true);

            var el = $('#signature-modal-tab-camera video')[0],
                videoObj = {
                    'video': true
                },
                attachVideoStream = _.bind(function(stream) {
                    if (this.get('videoStarted')) {
                        this.set('video', stream);
                        el.play();
                        return true;
                    }

                    // this happens when user approves video request, but Camera tab is not active anymore
                    stream.stop();
                    this.set('videoRequested', false);
                    return false;
                }, this),
                onError = _.bind(function(error) {
                    this.set('errorMessage', _.isObject(error) ? 'Cannot load video from camera. Please check your settings' : ('Video capture error: ' + error));
                }, this);

            // Put video listeners into place
            if (navigator.getUserMedia) { // Standard
                navigator.getUserMedia(videoObj, function(stream) {
                    if (attachVideoStream(stream)) {
                        el.src = stream;
                    }
                }, onError);
            } else if (navigator.webkitGetUserMedia) { // WebKit-prefixed
                navigator.webkitGetUserMedia(videoObj, function(stream) {
                    if (attachVideoStream(stream)) {
                        el.src = window.URL.createObjectURL(stream);
                    }
                }, onError);
            } else if (navigator.mozGetUserMedia) { // Firefox-prefixed
                navigator.mozGetUserMedia(videoObj, function(stream) {
                    if (attachVideoStream(stream)) {
                        el.src = window.URL.createObjectURL(stream);
                    }
                }, onError);
            }
        }
    },

    stopVideo: function() {
        if (this.get('video')) {
            var el = $('#signature-modal-tab-camera video')[0];
            el.pause();
            el.src = "";

            this.get('video').stop();
            this.set('video', null);
            this.set('videoRequested', false);
        }

        this.set('videoStarted', false);
    },

    clear: function(tab) {
        var selector;

        if (tab) {
            selector = tab === 'draw' ? '#signature-modal-tab-draw canvas' : '#signature-modal-tab-type canvas';
        } else {
            selector = '#signature-modal-tab-draw canvas, #signature-modal-tab-type canvas';
        }

        if (selector !== '#signature-modal-tab-draw canvas') {
            this.set('signatureText', '');
        }

        $(selector).each(function(index, canvas) {
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        });
    },

    createDropZone: function() {
        var el = $('#signature-modal'),
            dropZone = $('#signature-modal-tab-dragndrop'),
            dragLeaveTimer = null;

        el.on('dragover', function(evt) {
            clearTimeout(dragLeaveTimer);
            dropZone.addClass('file-hover');
            evt.dataTransfer.dropEffect = 'copy';
            return false;
        });

        el.on('dragleave', function() {
            dragLeaveTimer = setTimeout(function() {
                dropZone.removeClass('file-hover');
            }, 500);

            return false;
        });

        el.on('drop', _.bind(function(e) {
            dropZone.removeClass('file-hover');
            e.preventDefault();
            e.stopPropagation();

            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                this.saveFile(e.dataTransfer.files[0]);
            }
        }, this));
    },

    saveFile: function(file) {
        Ember.run(this, function() {
            this.set('errorMessage', '');
            this.set('saving', true);

            if (file.type.match(/image.*/)) {
                var reader = new FileReader();

                reader.onload = _.bind(function(e) {
                    var img = new Image();

                    img.onload = _.bind(function() {
                        var canvas = document.createElement('CANVAS'),
                            ctx = canvas.getContext('2d');

                        canvas.height = img.height;
                        canvas.width = img.width;
                        ctx.drawImage(img, 0, 0);
                        var dataURL = canvas.toDataURL('image/jpeg');
                        $(canvas).remove();
                        canvas = null;

                        this.createSignatureTask(dataURL.substr('data:image/jpeg;base64,'.length), _.escape(file.name), true,
                            function() {
                                $('#signature-modal').modal('hide');
                                $('#signature-capture-modal').modal('show');
                            },
                            function(err, id, rec) {
                                $('#signature-capture-modal').modal('hide');

                                if (rec && this.get('clientOnly')) {
                                    this.sendAction('addFormSignature', {
                                        img: rec.img,
                                        h: rec.h,
                                        w: rec.w
                                    });
                                }
                            });
                    }, this);

                    img.src = e.target.result;
                }, this);

                reader.readAsDataURL(file);
            } else {
                App.showError('Only images are allowed');
            }
        });
    },

    createSignatureTask: function(imgSrc, name, isFile, ffdStartCallback, ffdEndCallback, ajaxError) {
        var onSuccess = function(task) {
                var socket = App.get('socket'),
                    userId = App.get('userId'),
                    socketEventPrefix = userId.indexOf('non-registered-user-') === 0 ? userId + '.' : '',
                    complete = _.bind(function(err, id, rec) {
                        ffdEndCallback.call(this, err, id, rec);
                        socket.off(socketEventPrefix + 'signature.insert.' + task.taskId, insert);
                        socket.off(socketEventPrefix + 'signature.fail.' + task.taskId, fail);
                    }, this),
                    insert = function(data) {
                        Ember.run(this, function() {
                            App.showNotification('Your signature was created', true);

                            if (this.get('clientOnly')) {
                                complete(false, null, data.rec);
                            } else {
                                this.get('targetObject.store').find('signature', data.id);
                                complete(false, data.id);
                            }
                        });
                    },
                    fail = function(data) {
                        Ember.run(this, function() {
                            this.set('errorMessage', data.message);
                            complete(true);
                        });
                    };

                socket.on(socketEventPrefix + 'signature.insert.' + task.taskId, _.bind(insert, this));
                socket.on(socketEventPrefix + 'signature.fail.' + task.taskId, _.bind(fail, this));

                this.set('errorMessage', '');
                this.set('saving', false);
                ffdStartCallback.call(this);
            },
            onError = function(xhr, textStatus, errorThrown) {
                Ember.run(this, function() {
                    if (xhr.status === 200) {
                        onSuccess.call(this, JSON.parse(xhr.responseText));
                    } else {
                        var message = 'Failed to capture signature.';

                        if (xhr.responseText) {
                            try {
                                message = JSON.parse(xhr.responseText).message;
                            } catch (e) {}
                        }

                        this.set('errorMessage', message);
                        this.set('saving', false);

                        if (ajaxError) {
                            ajaxError.call(this);
                        }
                    }
                });
            };

        $.ajax({
            url: sprintf('/api/v1.0/users/%s/signatures', App.get('userId')),
            type: 'POST',
            data: JSON.stringify({
                action: this.get('clientOnly') ? 'captureSignatureForForm' : 'captureSignature',
                name: name,
                type: this.get('signatureType'),
                imgSrc: imgSrc,
                noCrop: isFile
            }),
            contentType: 'application/json',
            cache: false,
            dataType: 'json',
            context: this,
            processData: false, // Don't process the files
            success: onSuccess,
            error: onError
        });
    },

    signatureColorObserver: function() {
        var realisticPen = this.get('realisticPen');
        realisticPen.setPenColor(this.get('signatureColor'));
    }.observes('signatureColor'),

    updateTypeCanvas: function() {
        if (this.get('activeTab') === 'type') {
            var text = this.get('signatureText').trim() || '',
                font = this.get('currentFont'),
                canvas = $('#signature-modal-tab-type canvas'),
                ctx = canvas[0].getContext('2d'),
                fontSize = 70,
                containerWidth = canvas.width() - this.CANVAS_PADDING_LEFT;

            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            if (text.length) {
                fontSize = this.get('prevFontSize');
                ctx.font = fontSize + 'px "' + font + '"';

                var textMeasurments = ctx.measureText(text);

                // first - make text bigger than canvas - when user deletes text
                while (textMeasurments.width < containerWidth && fontSize <= 70) {
                    fontSize += 1;
                    ctx.font = fontSize + 'px "' + font + '"';
                    textMeasurments = ctx.measureText(text);
                }

                // now make it fit into canvas
                while (textMeasurments.width > containerWidth && fontSize > 1) {
                    fontSize -= 1;
                    ctx.font = fontSize + 'px "' + font + '"';
                    textMeasurments = ctx.measureText(text);
                }

                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

                ctx.font = fontSize + 'px "' + font + '"';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = this.get('signatureColor');
                ctx.fillText(text, this.CANVAS_PADDING_LEFT, (this.get('canvasHeight') + fontSize) / 2);
            }

            this.set('prevFontSize', fontSize);
        }
    }.observes('signatureText', 'currentFont', 'signatureColor'),

    captureSignatureToFfd: function() {
        var img = new Image(),
            cropImageData,
            loading = Ladda.create($('#signature-modal-capture')[0]);

        $('#signature-modal-tab-camera video')[0].pause();

        this.set('signaturePreview', null);
        this.set('errorMessage', '');
        this.set('saving', true);
        loading.start();

        img.onload = _.bind(function() {
            this.createSignatureTask(img.src.substr('data:image/jpeg;base64,'.length), 'camera.png', false,
                function() {
                    this.set('awaitingSignaturePreview', true);
                },
                function(err, signatureId, rec) {
                    loading.stop();
                    this.videoPlay();

                    if (err) {
                        this.set('awaitingSignaturePreview', false);
                    } else if (rec && this.get('clientOnly')) {
                        this.set('awaitingSignaturePreview', false);
                        this.set('signaturePreview', Ember.Object.create(rec));
                    } else {
                        this.get('targetObject.store').find('signature', signatureId).then(_.bind(function(rec) {
                            this.set('awaitingSignaturePreview', false);
                            this.set('signaturePreview', rec);
                        }, this));
                    }
                },
                function() {
                    loading.stop();
                    this.videoPlay();
                });
        }, this);

        var croppedCanvas = $('<canvas>').attr({
            width: 640,
            height: 320,
            style: 'display: block'
        })[0];

        croppedCanvas.getContext('2d').drawImage($('#signature-modal-tab-camera canvas')[0],
            0, (480 - 320) / 2, 640, 320,
            0, 0, 640, 320);

        img.src = croppedCanvas.toDataURL('image/jpeg');
    },

    videoPlay: function() {
        var videoEl = $('#signature-modal-tab-camera video')[0];

        if (videoEl && videoEl.play) {
            videoEl.play();
        }
    },

    saveCanvas: function(buttonSelector, select) {
        var img = new Image(),
            cropImageData,
            loading = Ladda.create($(buttonSelector)[0]),
            addSharedFormSignature = function() {
                loading.stop();
                this.set('saving', false);
                $('#signature-modal').modal('hide');

                this.sendAction('addFormSignature', {
                    img: img.src, // this is always PNG format
                    h: cropImageData.h,
                    w: cropImageData.w
                });
            },
            saveRecord = function() {
                var rec = this.get('targetObject.store').createRecord('signature', {
                        img: img.src, // this is always PNG format
                        h: cropImageData.h,
                        w: cropImageData.w,
                        type: this.get('isInitials') ? 'initials' : 'signature'
                    }),
                    promise = rec.save();

                promise.then(_.bind(function(rec) {
                    if (select) {
                        this.sendAction('selectSignature', rec);
                    }

                    $('#signature-modal').modal('hide');
                }, this));

                promise.catch(_.bind(function(err) { // jshint ignore:line
                    this.set('errorMessage', 'Failed to save signature');
                }, this));

                promise.finally(_.bind(function() { // jshint ignore:line
                    loading.stop();
                    this.set('saving', false);
                }, this));
            };

        this.set('errorMessage', '');
        this.set('saving', true);
        loading.start();

        if (this.get('clientOnly')) {
            img.onload = _.bind(addSharedFormSignature, this);
        } else {
            img.onload = _.bind(saveRecord, this);
        }

        cropImageData = this.getCroppedImage('image/png');

        if (cropImageData.w === 1 && cropImageData.h === 1) {
            loading.stop();
            this.set('saving', false);
            this.set('errorMessage', 'Failed to save empty signature');
            return;
        }

        img.src = cropImageData.img;
    },

    getCroppedImage: function(format) {
        var canvas = this.get('activeCanvas')[0],
            ctx = canvas.getContext('2d'),
            imgWidth = canvas.width,
            imgHeight = canvas.height,
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height),
            data = imageData.data,
            isTransparent = function(x, y) {
                return data[(imgWidth * y + x) * 4 + 2] === 0;
            },
            scanY = function(fromTop) {
                var offset = fromTop ? 1 : -1;

                // loop through each row
                for (var y = fromTop ? 0 : imgHeight - 1; fromTop ? (y < imgHeight) : (y > -1); y += offset) {
                    // loop through each column
                    for (var x = 0; x < imgWidth; x++) {
                        if (!isTransparent(x, y)) {
                            return y;
                        }
                    }
                }

                return 0;
            },
            scanX = function(fromLeft) {
                var offset = fromLeft ? 1 : -1;

                // loop through each column
                for (var x = fromLeft ? 0 : imgWidth - 1; fromLeft ? (x < imgWidth) : (x > -1); x += offset) {
                    // loop through each row
                    for (var y = 0; y < imgHeight; y++) {
                        if (!isTransparent(x, y)) {
                            return x;
                        }
                    }
                }

                return 0;
            };

        var cropTop = scanY(true),
            cropBottom = scanY(false),
            cropLeft = scanX(true),
            cropRight = scanX(false);

        var croppedCanvas = $('<canvas>').attr({
            width: cropRight - cropLeft + 1,
            height: cropBottom - cropTop + 1
        })[0];

        // finally crop
        croppedCanvas.getContext('2d').drawImage(canvas,
            cropLeft, cropTop,
            cropRight - cropLeft + 1,
            cropBottom - cropTop + 1,
            0, 0, cropRight - cropLeft + 1, cropBottom - cropTop + 1);

        return {
            img: croppedCanvas.toDataURL(format),
            w: cropRight - cropLeft + 1,
            h: cropBottom - cropTop + 1
        };
    },

    resizeActiveCanvas: function() {
        if (this.get('activeTab') !== 'camera') {
            var canvas = this.get('activeCanvas'),
                container;

            if (canvas) {
                container = canvas.closest('.canvas-container');

                //Adjust canvas to container's size only when dhey differs. That prevents canvas erasing
                if (canvas.prop('height') != container.innerHeight() || this.get('canvasHeight') !== container.innerHeight()) {
                    canvas.prop('height', container.innerHeight());
                    this.set('canvasHeight', container.innerHeight());
                }

                if (canvas.prop('width') != container.width()) {
                    canvas.prop('width', container.width());
                }
            }
        }
    },

    getColorPickerValue: function() {
        var el = $(sprintf('#signature-modal-tab-%s .sm-color-picker', this.get('activeTab')));
        return el.length ? el.find('.item.active').css('background-color') : '';
    },

    setColorPickerValue: function(value) {
        var el = $(sprintf('#signature-modal-tab-%s .sm-color-picker', this.get('activeTab')));

        if (el.length) {
            el.find('.item.active').removeClass('active');
            el.find('.item.color-' + value).addClass('active');
        }
    },

    focusInput: function() {
        if (this.get('activeTab') === 'type') {
            $('#signature-modal-tab-type .sm-signature-input')[0].focus();
        }
    }.observes('activeTab'),

    discardSignaturePreview: function() {
        this.videoPlay();

        if (this.get('signaturePreview')) {
            if (this.get('signaturePreview').destroyRecord) {
                this.get('signaturePreview').destroyRecord();
            }

            this.set('signaturePreview', null);
        }
    }
});
