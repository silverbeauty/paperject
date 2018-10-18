'use strict';

/*global jsPDF,PDFJS,LZString*/
App.PdfExportService = Ember.Object.extend({
    OBJECT_POS_FACTOR: 100000,

    pdfJsLoaderService: null, // injected

    // for Grunt usemin task
    revved_image_names: {
        'check-square-o_000000_512': 'check-square-o_000000_512.png',
        'check-square-o_0000ff_512': 'check-square-o_0000ff_512.png',
        'check-square-o_00ff00_512': 'check-square-o_00ff00_512.png',
        'check-square-o_ff0000_512': 'check-square-o_ff0000_512.png',
        'check-square-o_ff00ff_512': 'check-square-o_ff00ff_512.png',
        'check-square-o_ffffff_512': 'check-square-o_ffffff_512.png',
        'square-o_000000_512': 'square-o_000000_512.png',
        'square-o_0000ff_512': 'square-o_0000ff_512.png',
        'square-o_00ff00_512': 'square-o_00ff00_512.png',
        'square-o_ff0000_512': 'square-o_ff0000_512.png',
        'square-o_ff00ff_512': 'square-o_ff00ff_512.png',
        'square-o_ffffff_512': 'square-o_ffffff_512.png'
    },

    /**
     * Creates PDF pages with user's content, creates 'print' task in the queue, waits for Redis notification, downloads final PDF.
     * @param  {[type]}   pages    Pages from Mongo
     * @param  {[type]}   docId    ID of document
     * @param  {Function} callback function accepts err, printUrl
     */
    savePrintedPdf: function(doc, pages, isDownload, password, callback) {
        this.exportPages(doc, pages, function(pdf) {
            this._printPdf(pdf, doc.get('id'), doc.get('printUrl'), isDownload, password, callback);
        }, this);
    },

    printInBrowser: function(doc, store, callback) {
        App.showNotification('Document is being prepared for print. Please wait...', true);

        store.find('page', {
            doc: doc.get('id')
        }).then(_.bind(function(pages) {
            this.savePrintedPdf(doc, pages.toArray(), false, null, _.bind(function(err) {
                if (err) {
                    App.showError(err);
                    callback(err);
                } else {
                    App.clearNotificationMessage();
                    this._renderPdfForPrintInBrowser(doc.get('printUrl'), callback);
                }
            }, this));
        }, this));
    },

    _renderPdfForPrintInBrowser: function(printUrl, callback) {
        var renderPages = function(pdfDoc) {
            var canvasContainer,
                totalPages = pdfDoc.numPages,
                pagesRendered = 0,
                pageRendered = function() {
                    pagesRendered++;
                    //call print dialog only when all pages will be rendered
                    if (totalPages === pagesRendered) {
                        window.print();
                        callback();
                    }
                },
                onError = function(err) {
                    App.showError(err.statusText);
                    callback(err.statusText);
                },
                renderPage = function(page) {
                    var viewport = page.getViewport(1.5),
                        canvas = window.document.createElement('canvas'),
                        ctx = canvas.getContext('2d'),
                        renderContext = {
                            canvasContext: ctx,
                            viewport: viewport
                        };

                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    canvasContainer.appendChild(canvas);

                    page.render(renderContext).then(pageRendered)
                        .catch(_.bind(onError, this)); // jshint ignore:line
                };

            $('#printed-document-container').remove();
            canvasContainer = $('<div></div>').attr('id', 'printed-document-container').addClass('printed-document-container');
            $('body').append(canvasContainer);
            canvasContainer = canvasContainer[0];

            for (var i = 1; i <= totalPages; i++) {
                pdfDoc.getPage(i).then(_.bind(renderPage, this))
                    .catch(onError); // jshint ignore:line
            }
        };

        this.pdfJsLoaderService.load(function() {
            PDFJS.getDocument(printUrl).then(_.bind(renderPages, this))
                .catch(function(err) { // jshint ignore:line
                    App.showError('Unable to get the document');
                    callback(err);
                });
        }, this);
    },

    // loads images, creates pages, and calls 'callback' with result
    exportPages: function(doc, pages, callback, scope) {
        this._loadImages(doc, pages, callback, scope);
    },

    _hexToRgb: function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    _getFont: function(obj) {
        if (obj.style && obj.style.fontFamily) {
            if (obj.style.fontFamily.toLowerCase().indexOf('sans-serif') !== -1) {
                return 'helvetica';
            }

            if (obj.style.fontFamily.toLowerCase().indexOf('serif') !== -1) {
                return 'times';
            }

            if (obj.style.fontFamily.toLowerCase().indexOf('courier') !== -1) {
                return 'courier';
            }
        }

        return 'helvetica';
    },

    _getFontType: function(obj) {
        var result = '';

        if (obj.style) {
            if (obj.style.fontWeight === 'bold') {
                result += 'bold';
            }

            if (obj.style.fontStyle === 'italic') {
                result += 'italic';
            }
        }

        return result || 'normal';
    },

    _createPdfPages: function(pages, pageCount, images, callback, scope) {
        var result = [],
            POINTS_IN_CM = 72 / 2.54, // 28.3464567 PostScript spec
            TEXT_SIZE_RATIO = 0.65, // this is from DocEditView.js
            doc = null,
            getRowsNumber = function(str) {
                if (!_.isString(str)) {
                    str = '';
                }

                return (str.match(/\n/g) || []).length + 1;
            },
            getPageByIndex = function(i) {
                var pageIndex = _.findIndex(pages, function(page) {
                    return page.get('i') === i + 1;
                });

                return pageIndex === -1 ? null : pages[pageIndex];
            };

        for (var i = 0; i < pageCount; i++) {
            var page = getPageByIndex(i),
                w = page ? page.get('w') : null,
                h = page ? page.get('h') : null;

            // check if page was edited in UI editor
            // if page was not edited, but was scanned, there is nothing we should change on it
            if (w && h) {
                if (!doc) {
                    doc = new jsPDF(w > h ? 'landscape' : 'portrait', 'cm', [w, h]);
                } else {
                    doc.addPage([w, h], w > h ? 'landscape' : 'portrait');
                }
                var objects = page.get('objects');

                for (var j = 0; j < objects.length; j++) {
                    var obj = objects[j],
                        objX = w * obj.x / this.OBJECT_POS_FACTOR,
                        objY = h * obj.y / this.OBJECT_POS_FACTOR,
                        objW = w * obj.w / this.OBJECT_POS_FACTOR,
                        objH = h * obj.h / this.OBJECT_POS_FACTOR,
                        round,
                        textSize,
                        textY,
                        letterDimensions,
                        letterW,
                        letterH,
                        color = this._hexToRgb(obj.style ? obj.style.color : ''),
                        rowsNumber;

                    if (obj.type === 'field' || obj.type === 'multicell') {
                        rowsNumber = getRowsNumber(obj.text);

                        if (obj.fontSize) {
                            textSize = POINTS_IN_CM * TEXT_SIZE_RATIO * h * obj.fontSize / this.OBJECT_POS_FACTOR;
                        } else {
                            textSize = POINTS_IN_CM * TEXT_SIZE_RATIO * objH / getRowsNumber(obj.text);
                        }

                        textY = objY + (objH - (objH - objH * TEXT_SIZE_RATIO) / 2) / rowsNumber;
                    }

                    switch (obj.type) {
                        case 'field':
                            if (obj.text) {
                                if (color) {
                                    doc.setTextColor(color.r, color.g, color.b);
                                } else {
                                    doc.setTextColor(0);
                                }

                                doc.setFontSize(textSize);
                                doc.setFont(this._getFont(obj));
                                doc.setFontType(this._getFontType(obj));

                                letterDimensions = doc.getTextDimensions('A');
                                letterH = letterDimensions.h / POINTS_IN_CM;

                                doc.text(objX + (textSize / POINTS_IN_CM) * 0.15, textY, obj.text);
                            }
                            break;
                        case 'multicell':
                            if (obj.text) {
                                // objX += objH * 0.1;
                                var boxW = objW / obj.numCells;

                                if (color) {
                                    doc.setTextColor(color.r, color.g, color.b);
                                } else {
                                    doc.setTextColor(0);
                                }

                                doc.setFont('helvetica');
                                doc.setFontSize(textSize);
                                doc.setFontType(this._getFontType(obj));

                                letterDimensions = doc.getTextDimensions('A');
                                letterH = letterDimensions.h / POINTS_IN_CM;
                                letterW = letterDimensions.w / POINTS_IN_CM;

                                for (var letterIndex = 0; letterIndex < obj.text.length; ++letterIndex) {
                                    doc.text(objX + letterIndex * boxW + (boxW - letterW) / 2, textY, obj.text[letterIndex]);
                                }
                            }
                            break;
                        case 'rect':
                            if (color) {
                                doc.setFillColor(color.r, color.g, color.b);
                                doc.setDrawColor(color.r, color.g, color.b);
                            } else {
                                doc.setFillColor(0);
                                doc.setDrawColor(0);
                            }

                            doc.setLineWidth(objH / 30);
                            round = Math.min(objW / 20, objH / 20);

                            doc.roundedRect(objX, objY, objW, objH,
                                // rounded corners
                                round, round, obj.fill ? 'F' : 'D');
                            break;
                        case 'checkbox':
                            if (!_.isUndefined(obj.check)) { // undefined means that it was not touched yet
                                doc.addImage(images[page.get('i') + '.' + j], 'PNG', objX, objY, objW, objH);
                            }
                            break;
                        case 'signature':
                            if (!obj.request || obj.edited) {
                                doc.addImage(images[page.get('i') + '.' + j], 'PNG', objX, objY, objW, objH); // PNG is the only format supported by SignatureManager
                            }
                            break;
                    }
                }
            } else {
                if (!doc) {
                    doc = new jsPDF();
                } else {
                    doc.addPage();
                }
            }
        }

        if (!doc) {
            doc = new jsPDF();
        }

        var str = btoa(doc.output());
        str = LZString.compressToBase64(str);
        callback.call(scope, str);
    },

    // if pageCount is not set, load PDF to get it, and then call _createPdfPages
    _getPageCount: function(doc, pages, images, callback, scope) {
        if (doc.get('pageCount')) {
            this._createPdfPages.call(this, pages, doc.get('pageCount'), images, callback, scope);
        } else {
            this.pdfJsLoaderService.load(function() {
                PDFJS.getDocument(doc.get('fileUrl')).then(_.bind(function(pdf) {
                    this._createPdfPages.call(this, pages, pdf.numPages, images, callback, scope);
                }, this));
            }, this);
        }
    },

    // Loads images asynchronously, and calls _getPageCount
    _loadImages: function(doc, pages, callback, scope) {
        var images = {},
            objects,
            obj,
            img,
            imgName,
            pendingOperations = 1,
            onLoad = _.bind(function() {
                if (--pendingOperations === 0) {
                    this._getPageCount.call(this, doc, pages, images, callback, scope);
                }
            }, this);

        for (var i = 0; i < pages.length; i++) {
            objects = pages[i].get('objects');

            for (var j = 0; j < objects.length; j++) {
                obj = objects[j];
                if (obj.type === 'signature' || (obj.type === 'checkbox' && !_.isUndefined(obj.check))) {
                    ++pendingOperations;
                    img = new Image();
                    img.onload = onLoad;

                    if (obj.type === 'signature') {
                        img.src = obj.img;
                    } else {
                        imgName = sprintf('%ssquare-o_%s_512', obj.check ? 'check-' : '', obj.style && obj.style.color ? obj.style.color.substr(1) : '000000');
                        imgName = this.revved_image_names[imgName];
                        img.src = '/images/editor/' + imgName;
                    }

                    images[pages[i].get('i') + '.' + j] = img;
                }
            }
        }

        onLoad();
    },

    // creates 'print' task in the queue, waits for Redis notification, downloads final PDF
    _printPdf: function(pdf, docId, printUrl, isDownload, password, callback) {
        var onSuccess = _.bind(function() {
            var eventName = sprintf('doc.%s.pdf.insert', docId);

            var onDownloadComplete = _.bind(function() {
                App.socket.removeListener(eventName, onDownloadComplete);

                if (callback) {
                    callback(null, printUrl);
                } else {
                    window.location = printUrl;
                }
            }, this);

            App.socket.on(eventName, onDownloadComplete);
        }, this);

        $.ajax({
            url: sprintf('/api/v1.0/users/%s/documents/%s', App.get('userId'), docId),
            type: 'POST',
            data: JSON.stringify({
                action: 'print',
                password: password,
                isDownload: isDownload,
                pdf: pdf
            }),
            contentType: 'application/json',
            cache: false,
            dataType: 'json',
            context: this,
            processData: false, // Don't process the files
            success: onSuccess,
            error: function(xhr, textStatus, errorThrown) {
                if (xhr.status === 200) {
                    onSuccess();
                } else {
                    var message = 'Failed to print document';

                    if (xhr.responseText) {
                        try {
                            message = JSON.parse(xhr.responseText).message;
                        } catch (e) {}
                    }

                    if (callback) {
                        callback(message);
                    } else {
                        App.showError(message);
                    }
                }
            }
        });
    }
});
