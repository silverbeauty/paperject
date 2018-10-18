'use strict';

/*global unescape*/

var session = require('../middleware/session'),
    fs = require('fs'),
    _ = require('lodash'), // jshint ignore:line
    passport = require('passport'),
    tmp = require('tmp'),
    async = require('async'),
    https = require('https'),
    http = require('http'),
    atob = require('atob'), // jshint ignore:line
    url = require('url'),
    path = require('path'),
    sprintf = require('sprintf'), // jshint ignore:line
    mongoose = require('mongoose'),
    utils = require('../utils'),
    config = require('../config')(),
    strings = require('../strings'),
    winston = require('winston'),
    request = require('request'),
    signatureRequest = require('../services/signatureRequest'),
    cloneDoc = require('../services/cloneDoc'),
    genericContentTypes = require('../services/genericContentTypes'),
    storage = require('../common/server/storage')(config),
    convertableDocumentFormats = {
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
        'image/png': 'png'
    },
    supportedMimeTypes = _.assign(_.clone(convertableDocumentFormats), {
        'application/pdf': 'pdf'
    }),
    convertableDocumentExts = _.values(convertableDocumentFormats),
    defaultFolders,
    isPdfFile = function(mimeType, fileName) {
        if (mimeType === 'application/pdf' || mimeType === 'application/x-pdf') {
            return true;
        }

        fileName = (fileName || '').toLowerCase().trim();

        if (genericContentTypes.indexOf(mimeType.toLowerCase()) !== -1 && fileName.lastIndexOf('.pdf') === fileName.length - 4) {
            return true;
        }

        return false;
    },
    loadDefaultFolders = function(callback) {
        if (defaultFolders) {
            callback();
            return;
        }

        mongoose.models.Folder.find({
            alias: {
                $in: ['my-documents', 'trash', 'inbox']
            }
        }, function(err, folders) {
            if (err) {
                callback(err);
                return;
            }

            if (!folders || folders.length !== 3) {
                callback('Expected three default folders, got ' + folders.length);
                return;
            }

            var myDocuments = _.find(folders, _.matchesProperty('alias', 'my-documents')),
                trash = _.find(folders, _.matchesProperty('alias', 'trash')),
                inbox = _.find(folders, _.matchesProperty('alias', 'inbox'));

            if (!myDocuments || !trash || !inbox) {
                callback('Default folder not found.');
                return;
            }

            defaultFolders = {
                trash: trash.id,
                inbox: inbox.id,
                myDocuments: myDocuments.id
            };

            callback();
        });
    },
    // detectFields=false only for file uploads with flag enableFfd=false.
    // detectFields=true for URL uploads and sample file uploads.
    detectFieldsInUpload = function(doc, res, detectFields) {
        mongoose.models.Task.create({
            type: 'pageCount',
            doc: doc.id,
            user: doc.user.toJSON(),
            priority: 2,
            status: 'ready',
            config: {
                detectFields: detectFields,
                previewKey: doc.previewKey,
                documentKey: doc.fileKey,
                documentRegion: doc.storageRegion,
                documentBucket: doc.storageBucket
            }
        }, function(err) {
            if (err) {
                winston.error('Failed to create tasks for doc %s.', doc.id);
                winston.error(err + '');
            }

            utils.notifyAboutNewTask();
        });
    },
    uploadPdfAndDetectFields = function(app, doc, buffer, req, res, doNotScan, auditData, detectFields) {
        winston.silly('Uploading %s to %s, %s, %s. doNotScan=%s, detectFields=%s', doc.id, doc.fileKey, doc.storageBucket, doc.storageRegion, !!doNotScan, detectFields);

        var sendError = function(err) {
            winston.error(err);
            return res.status(500).json({
                message: 'Unable to upload: ' + err
            });
        };

        storage.putBuffer(doc.fileKey, doc.storageBucket, doc.storageRegion, buffer, function(err) {
            if (err) {
                return sendError(err);
            }

            if (!doNotScan) {
                winston.silly('Request scan %s', doc.id);
                detectFieldsInUpload(doc, res, detectFields);
            }

            winston.silly('Uploaded %s', doc.id);

            res.json({
                detectorMessage: 'Document scan queued',
                document: doc.getPublicData()
            });

            app.emit('audit', 'document.insert', {
                req: req,
                data: auditData
            });

            app.emit('dbupdate', req, 'document', 'insert', doc.id, doc.getPublicData());
        }, true);
    },
    createDocumentRecord = function(fileName, fileSize, folderId, req, callback) {
        loadDefaultFolders(function(err) {
            if (err) {
                callback(err);
                return;
            }

            var json = {
                name: fileName,
                fileName: fileName,
                authorName: req.user.displayName,
                user: req.user._id,
                storageBucket: config.s3.documentsBucket,
                storageRegion: config.s3.documentsRegion,
                fileSize: fileSize
            };

            if (folderId && folderId !== defaultFolders.trash) {
                json.folders = [folderId];
            } else {
                json.folders = [defaultFolders.myDocuments];
            }

            mongoose.models.Document.create(json, function(err, rec) {
                if (err) {
                    callback(err);
                    return;
                }
                console.log('mongoose.models.Document'+mongoose.models.Document);
                rec.setStorageKey(config.s3.instancePrefix);
                rec.save(callback);
            });
        });
    },
    convertToPdf = function(uploadedFile, contextStr, done) {
        var originalExt = path.extname(uploadedFile),
            start = Date.now(),
            runCloudConvert = function(inputFile) {
                var isRequestProcessing = true,
                    _convert = function(inputFile, outputFile) {
                        winston.info('Sending %s to CloudConvert', inputFile);
                        winston.info('Will be saved to %s', outputFile);

                        var options = {
                                'apikey': config.cloudConvert.apiKey,
                                'inputformat': originalExt,
                                'outputformat': 'pdf'
                            },
                            apiRequest = request.post({
                                url: 'https://api.cloudconvert.com/convert',
                                followAllRedirects: true,
                                qs: options
                            }).on('error', function(err) {
                                isRequestProcessing = false;
                                done(err);
                            }).on('response', function(response) {
                                if (response.headers['content-type'] != 'application/pdf') {
                                    isRequestProcessing = false;
                                    winston.error('CloudConvert returned %s instead of PDF', response.headers['content-type'], contextStr);
                                    return done('Conversion failed');
                                }

                                this.pipe(fs.createWriteStream(outputFile));
                                this.on('end', function() {
                                    isRequestProcessing = false;
                                    winston.info('Conversion of %s is done', inputFile);
                                    done(null, outputFile, Date.now() - start);
                                });
                            });
                        if (inputFile) {
                            apiRequest.form().append("file", fs.createReadStream(inputFile));
                        }

                        return apiRequest;
                    },
                    attemptsCount = 0,
                    maxAttempts = 2,
                    apiRequest;


                tmp.tmpName({
                    postfix: '.pdf'
                }, function(err, outputFile) {
                    if (err) {
                        return done(err);
                    }

                    apiRequest = _convert(inputFile, outputFile);
                    setTimeout(function() {
                        if (isRequestProcessing) {
                            apiRequest.abort();
                            if (++attemptsCount <= maxAttempts) {
                                winston.info('CloudConvert timeout exceeded, try again (attempt %s)', attemptsCount);
                                apiRequest = _convert(inputFile, outputFile);
                            } else {
                                winston.error('CloudConvert failed with %s attempts', maxAttempts + 1);
                                done('CloudConvert failed');
                                // remove file if it was created
                                fs.exists(outputFile, function(exists) {
                                    if (exists) {
                                        fs.unlink(outputFile);
                                    }
                                });
                            }
                        }
                    }, 30000);
                });
            };

        originalExt = originalExt.slice(1, originalExt.length);
        winston.info('Converting from %s to PDF', originalExt.toUpperCase());

        runCloudConvert(uploadedFile);
    },
    uploadTestFile = function(req, res, app) {
        var fileName = 'gpaform.pdf',
            filePath = path.join(__dirname, '..', fileName),
            operations = 2,
            documentRecord,
            documentBuffer,
            upload = function() {
                if (--operations === 0) {
                    req.user.updateMetricsOnDocumentAdd(req, app, documentRecord);
                    uploadPdfAndDetectFields(app, documentRecord, documentBuffer, req, res, req.body.doNotScan === 'true', documentRecord.getAuditData(), true);
                }
            };

        fs.stat(filePath, utils.errorHandler(res, function(stats) {
            if ((req.user.metrics.usedStorage + stats.size) >= req.user.metrics.storageLimit) {
                return res.status(403).json({
                    message: 'You have no enough free space to upload this document'
                });
            }
            fs.readFile(filePath, utils.errorHandler(res, function(buffer) {
                documentBuffer = buffer;
                upload();
            }));

            createDocumentRecord(fileName, stats.size, req.body.folderId, req, utils.errorHandler(res, function(rec) {
                documentRecord = rec;
                upload();
            }));
        }));
    },
    streamConvertedPdfToS3 = function(originalFileName, filePath, folderId, req, res, app, auditData, detectFields) {
        fs.readFile(filePath, function(err, documentBuffer) {
            // file was read to buffer and can be deleted
            fs.exists(filePath, function(exists) {
                if (exists) {
                    fs.unlink(filePath);
                }
            });

            if (err) {
                winston.error('Unable to read converted PDF: ' + err);
                return res.status(400).json({
                    message: 'Unable to read converted PDF'
                });
            }

            var pdfFileName = path.basename(originalFileName, path.extname(originalFileName)) + '.pdf';
            createDocumentRecord(pdfFileName, documentBuffer.length, folderId, req, utils.errorHandler(res, function(documentRecord) {
                req.user.updateMetricsOnDocumentAdd(req, app, documentRecord);

                _.assign(auditData, documentRecord.getAuditData());
                auditData.converted = true;
                auditData.originalFileName = originalFileName;

                uploadPdfAndDetectFields(app, documentRecord, documentBuffer, req, res, req.body.doNotScan === 'true', auditData, detectFields);
            }));
        });
    },
    /**
     * Uploads file of any format (converts non-PDF files to PDF before uploading to S3)
     */
    uploadFile = function(req, res, app) {
        var fileName = req.files.doc.originalname.replace(/[^a-z0-9\. ]/gi, '_'),
            fileType = req.files.doc.mimetype.toLowerCase(),
            enableFfd = req.body.enableFfd !== 'false';

        if (!fileName) {
            return res.status(400).json({
                message: 'File name is required.'
            });
        }

        var uploadedDocSize = parseInt(req.headers['content-length'], 10);
        if (uploadedDocSize > app.get('UPLOAD_FILE_SIZE_LIMIT')) {
            return res.status(400).json({
                message: 'File size limit is 100Mb.'
            });
        }

        if ((req.user.metrics.usedStorage + uploadedDocSize) >= req.user.metrics.storageLimit) {
            return res.status(403).json({
                message: 'You have no enough free space to upload this document'
            });
        }

        if (convertableDocumentFormats.hasOwnProperty(fileType)) {
            app.emit('document.conversion.start', req.user.id);
            convertToPdf(req.files.doc.path, fileName + ' / ' + fileType, utils.errorHandler(res, function(outputFile, elapsedTime) {
                var auditData = {
                    conversionTime: elapsedTime
                };

                streamConvertedPdfToS3(fileName, outputFile, req.body.folderId, req, res, app, auditData, enableFfd);
            }));
        } else if (isPdfFile(fileType, fileName)) {
            var operations = 2,
                documentRecord,
                documentBuffer,
                upload = function() {
                    if (--operations === 0) {
                        req.user.updateMetricsOnDocumentAdd(req, app, documentRecord);
                        uploadPdfAndDetectFields(app, documentRecord, documentBuffer, req, res, req.body.doNotScan === 'true', documentRecord.getAuditData(), enableFfd);
                    }
                };

            fs.readFile(req.files.doc.path, utils.errorHandler(res, function(buffer) {
                documentBuffer = buffer;
                upload();
            }));

            fs.stat(req.files.doc.path, utils.errorHandler(res, function(stats) {
                createDocumentRecord(fileName, stats.size, req.body.folderId, req, utils.errorHandler(res, function(rec) {
                    documentRecord = rec;
                    upload();
                }));
            }));
        } else {
            winston.error('File format is not supported', fileType, fileName);
            return res.status(400).json({
                message: 'File format is not supported. Supported formats: ' + convertableDocumentExts.join(', ') + '.'
            });
        }
    },

    downloadFromUrlAndUploadToS3 = function(fileUrl, fileBaseName, urlFileExt, folderId, fileSize, downloadOptions, req, res, app) {
        var options = url.parse(fileUrl),
            client = http,
            fileSizeHasError = function(size) {
                if (size) {
                    if ((req.user.metrics.usedStorage + size) >= req.user.metrics.storageLimit) {
                        res.status(403).json({
                            message: 'You have no enough free space to upload this document'
                        });

                        return true;
                    }

                    if (size > app.get('UPLOAD_FILE_SIZE_LIMIT')) {
                        res.status(400).json({
                            message: 'File size limit is 100Mb.'
                        });

                        return true;
                    }
                }

                return false;
            };

        if (fileSizeHasError(fileSize)) { // google upload
            return;
        }

        if (options.protocol == 'https:') {
            client = https;
        }

        if (downloadOptions) {
            options = _.assign(options, downloadOptions);
        }

        options = _.assign(options, {
            headers: {
                // some servers require these headers, othervise send HTTP 400
                Accept: '*/*',
                Connection: 'keep-alive',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:36.0) Gecko/20100101 Firefox/36.0',
                'Cache-Control': 'no-cache'
            }
        });

        // application/pdf;charset=UTF-8 -> application/pdf
        var getFileType = function(fileType) {
                fileType = fileType || '';

                if (fileType.indexOf(';') !== -1) {
                    fileType = fileType.substr(0, fileType.indexOf(';'));
                }

                return fileType.trim().toLowerCase();
            },
            downloadRequest = client.get(options, function(downloadResponse) {
                if (downloadResponse.statusCode !== 200) {
                    res.status(400).json({
                        message: 'Download failed. Status ' + downloadResponse.statusCode
                    });

                    return;
                }

                if (!fileSize) {
                    fileSize = +downloadResponse.headers['content-length'] || 0; // content-length is optional
                }

                if (fileSizeHasError(fileSize)) {
                    return;
                }

                var fileType = getFileType(downloadResponse.headers['content-type']),
                    fileExt = isPdfFile(fileType, urlFileExt) ? '.pdf' : ('.' + supportedMimeTypes[fileType]),
                    fileName = fileBaseName + fileExt,
                    buffer = new Buffer(0),
                    uploadBuffer = function() {
                        if (convertableDocumentFormats.hasOwnProperty(fileType)) {
                            tmp.tmpName({
                                postfix: fileExt
                            }, utils.errorHandler(res, function(uploadedFileTmpName) {
                                fs.writeFile(uploadedFileTmpName, buffer, utils.errorHandler(res, function() {
                                    convertToPdf(uploadedFileTmpName, fileUrl, function(err, outputFile, elapsedTime) {
                                        fs.unlink(uploadedFileTmpName);

                                        if (err) {
                                            winston.error('Conversion failed', err);
                                            return res.status(400).json({
                                                message: 'Conversion failed'
                                            });
                                        }

                                        var auditData = {
                                            url: fileUrl,
                                            conversionTime: elapsedTime
                                        };

                                        streamConvertedPdfToS3(fileName, outputFile, folderId, req, res, app, auditData, true);
                                    });
                                }));
                            }));
                        } else {
                            createDocumentRecord(fileName, buffer.length, folderId, req, utils.errorHandler(res, function(documentRecord) {
                                var auditData = documentRecord.getAuditData();
                                auditData.url = fileUrl;

                                uploadPdfAndDetectFields(app, documentRecord, buffer, req, res, false, auditData, true);
                                req.user.updateMetricsOnDocumentAdd(req, app, documentRecord);
                            }));
                        }
                    },
                    onData = function(data) {
                        if (fileSize && data.length + buffer.length > fileSize) {
                            winston.error('Expected %s bytes for %s, got %s bytes.', fileSize, req.body.url, data.length + buffer.length);

                            // we need to remove the event listeners so that we don't end up here more than once
                            downloadResponse.removeListener('data', onData);
                            downloadResponse.removeListener('end', onEnd);

                            res.status(400).json({
                                message: 'Failed to download a file from external URL: size mismatch.'
                            });

                            return;
                        }

                        buffer = Buffer.concat([buffer, data]);
                    },
                    onEnd = function(args) {
                        if (fileSize && buffer.length !== fileSize) {
                            winston.error('Expected %s bytes for downloaded %s, got %s bytes.', fileSize, req.body.url, buffer.length);

                            res.status(400).json({
                                message: 'Failed to download a file from external URL: size mismatch.'
                            });

                            return;
                        }

                        if (fileSizeHasError(buffer.length)) {
                            return;
                        }

                        uploadBuffer();
                    };

                fileName = unescape(fileName);
                fileName = fileName.replace(/[^a-z0-9\. ]/gi, '_');

                if (!supportedMimeTypes.hasOwnProperty(fileType) && !isPdfFile(fileType, urlFileExt)) {
                    winston.error('File not supported', fileType, fileUrl);
                    res.status(400).json({
                        message: 'File not supported ' + fileType
                    });

                    return;
                }

                downloadResponse.on('data', onData);
                downloadResponse.on('end', onEnd);
            });

        downloadRequest.on('error', function(err) {
            winston.error('Download request failed:', err);
        });
    },
    uploadGoogleDriveFile = function(req, res, app) {
        var fileName = req.body.fileName,
            fileExt = path.extname(fileName),
            fileType = req.body.mimeType.toLowerCase();

        if (!fileName) {
            return res.status(400).json({
                message: 'File name is required.'
            });
        }

        if (!supportedMimeTypes.hasOwnProperty(fileType) && !isPdfFile(fileType, fileName)) {
            return res.status(400).json({
                message: 'File format is not supported. Supported formats: ' + convertableDocumentExts.join(', ') + '.'
            });
        }

        var downloadOptions = {
            headers: {
                Authorization: 'Bearer ' + req.body.accessToken
            }
        };

        // Pass basename without extension. Extension file be detected based on content-type header
        downloadFromUrlAndUploadToS3(req.body.url, path.basename(fileName, fileExt), fileExt, req.body.folderId, req.body.fileSize, downloadOptions, req, res, app);
    },
    uploadUrl = function(req, res, app) {
        if (!req.body.url) {
            return res.status(400).json({
                message: 'URL is required.'
            });
        }

        var downloadUrl = req.body.url,
            urlPieces = url.parse(downloadUrl),
            // Pass basename without extension (because link may not contain file extension).
            // Extension file be detected based on content-type header
            fileBaseName = path.basename(urlPieces.pathname, path.extname(urlPieces.pathname));

        downloadFromUrlAndUploadToS3(downloadUrl, fileBaseName, path.extname(urlPieces.pathname), req.body.folderId, 0, null, req, res, app);
    };

module.exports = function(app) {
    // temp fix
    app.get('/api/v1.0/pages/:id', session.isAuthenticated, function(req, res) {
        mongoose.models.Page.findById(req.params.id, utils.errorHandler(res, function(page) {
            if (!page) {
                return res.sendStatus(404);
            }

            mongoose.models.Document.findById(page.doc, utils.errorHandler(res, function(doc) {
                if (!doc || (doc.user.toJSON()) !== req.user.id) {
                    return res.sendStatus(404);
                }

                res.json({
                    pages: [page]
                });
            }));
        }));
    });

    // TODO: load related records only if there is a query parameter (https://github.com/emberjs/data/issues/1576)
    app.get('/api/v1.0/users/:userId/documents/:id', session.isAuthenticated, function(req, res) {
        var sendResult = function(doc, pages, folders, shared) {
                var docJson = doc.getPublicData();

                if (shared) {
                    docJson.readOnly = true;
                    docJson.shared = true;
                }

                res.json({
                    documents: [docJson],
                    pages: pages,
                    folders: folders
                });
            },
            docIsInSharedFolder = function(folders) {
                var sharedArr;

                for (var i = 0; i < folders.length; i++) {
                    sharedArr = folders[i].shared;

                    if (sharedArr) {
                        for (var j = 0; j < sharedArr.length; j++) {
                            if (sharedArr[j] + '' === req.params.userId) {
                                return true;
                            }
                        }
                    }
                }

                return false;
            };

        mongoose.models.Document.findById(req.params.id, utils.errorHandler(res, function(rec) {
            if (!rec) {
                return res.sendStatus(404);
            }

            async.parallel([
                function(cb) {
                    mongoose.models.Page.find({
                        doc: req.params.id
                    }, cb);
                },
                function(cb) {
                    mongoose.models.Folder.find({
                        _id: {
                            $in: rec.folders
                        }
                    }, cb);
                }
            ], function(err, results) {
                if (err) {
                    utils.errorHandler(res)(err);
                    return;
                }

                var shared = false;

                if (rec.signatureRequest) {
                    if (rec.signatureRequest.to !== req.user.email.toLowerCase()) {
                        if (rec.signatureRequest.acknowledged) {
                            // already acknowledged by another account
                            return res.sendStatus(403);
                        } else {
                            // assign to current account
                            rec.isViewed = true;
                            rec.set('signatureRequest.to', req.user.email.toLowerCase());
                            rec.set('signatureRequest.acknowledged', true);

                            rec.save(utils.errorHandler(res, function(rec) {
                                sendResult(rec, results[0], results[1]);
                            }));

                            return;
                        }
                    } else if (!rec.signatureRequest.acknowledged) {
                        rec.signatureRequest.acknowledged = true;
                        rec.isViewed = true;

                        rec.save(utils.errorHandler(res, function(rec) {
                            sendResult(rec, results[0], results[1]);
                        }));

                        return;
                    }
                } else if ((rec.user.toJSON()) !== req.params.userId) {
                    if (docIsInSharedFolder(results[1])) {
                        shared = true;
                    } else {
                        res.sendStatus(403);
                        return;
                    }
                }

                if (rec.isViewed === false) {
                    rec.isViewed = true;
                    rec.save(utils.errorHandler(res, function(rec) {
                        sendResult(rec, results[0], results[1], shared);
                    }));
                } else {
                    sendResult(rec, results[0], results[1], shared);
                }
            });
        }));
    });

    app.get('/api/v1.0/users/:userId/documents', session.isAuthenticated, session.checkOwnerParam, function(req, res) {
        async.parallel([
                function(cb) {
                    mongoose.models.SentItem.find({
                        user: req.user.id
                    }, '', {
                        sort: {
                            updatedAt: -1
                        }
                    }, cb);
                },
                function(cb) {
                    // load folders
                    mongoose.models.Folder.find({
                        $or: [{
                            isSystemFolder: true
                        }, {
                            user: req.user.id
                        }, {
                            shared: req.user.id
                        }]
                    }, function(err, folders) {
                        if (err) {
                            cb(err);
                            return;
                        }

                        // load docs
                        var foldersIds = [];

                        for (var i = 0; i < folders.length; i++) {
                            if (folders[i].shared && folders[i].shared.length > 0) {
                                foldersIds.push(folders[i].id);
                            }
                        }

                        var documentsQuery = {
                            $or: [{
                                user: req.user.id,
                                signatureRequest: {
                                    $exists: false
                                }
                            }, {
                                'signatureRequest.to': req.user.email
                            }, {
                                folders: {
                                    $in: foldersIds
                                }
                            }]
                        };

                        if (req.query.ids) {
                            documentsQuery._id = {
                                $in: req.query.ids
                            };
                        }

                        mongoose.models.Document.find(documentsQuery, function(err, documents) {
                            if (err) {
                                cb(err);
                                return;
                            }

                            cb(null, {
                                folders: folders,
                                documents: documents
                            });
                        });
                    });
                },
                function(cb) {
                    loadDefaultFolders(cb);
                }
            ],
            function(err, results) {
                if (err) {
                    utils.errorHandler(res)(err);
                    return;
                }

                var folders = results[1].folders,
                    documents = results[1].documents,
                    folderId,
                    shared,
                    i;

                for (i = 0; i < documents.length; i++) {
                    shared = (documents[i].user + '') !== req.user.id;
                    documents[i] = documents[i].getPublicData();
                    documents[i].shared = shared;

                    if (documents[i].folders && documents[i].folders.length) {
                        for (var j = 0; j < documents[i].folders.length; j++) {
                            folderId = documents[i].folders[j];

                            if (!_.any(folders, _.matchesProperty('_id', folderId))) {
                                documents[i].folders[j] = defaultFolders.myDocuments;
                            }
                        }
                    }
                }

                if (config.myDocumentsNotAvailable[utils.getHostPrefix(req)]) {
                    for (i = 0; i < folders.length; i++) {
                        if (folders[i].id === defaultFolders.myDocuments) {
                            folders.splice(i, 1);
                            break;
                        }
                    }
                }

                for (i = 0; i < folders.length; i++) {
                    shared = (folders[i].user + '') !== req.user.id;
                    folders[i] = folders[i].toJSON();
                    folders[i].shared = shared;
                }

                res.json({
                    documents: documents,
                    folders: folders,
                    sentItems: results[0]
                });
            });
    });

    app.post('/api/v1.0/users/:userId/documents', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own documents
        }

        var paidUntil = req.user.subscription ? req.user.subscription.paidUntil : null,
            nowDate = new Date(),
            supportsUpload = !config.uploadNotAvailable[utils.getHostPrefix(req)];

        if (!supportsUpload) {
            res.status(400).json({
                message: 'Uploads not supported'
            });

            return;
        }

        if (!paidUntil || (paidUntil < nowDate)) {
            var currentMonthMetrics = req.user.currentMetrics();
            if (currentMonthMetrics.monthly.documentsCount >= req.user.metrics.uploadsQuota) {
                return res.status(403).json({
                    message: 'Hey, looks like you reached the limit. Nice going! To keep your engines running, _invite_more_friends_ or treat yourself and _go_pro_!'
                });
            }
        }

        switch (req.body.action) {
            case 'uploadTestFile':
                uploadTestFile(req, res, app);
                return;
            case 'uploadFile':
                uploadFile(req, res, app);
                return;
            case 'uploadUrl':
                uploadUrl(req, res, app);
                return;
            case 'uploadGoogleDriveFile':
                uploadGoogleDriveFile(req, res, app);
                return;
        }

        res.status(400).json({
            message: 'Unknown action ' + req.body.action
        });
    });

    app.put('/api/v1.0/users/:userId/documents/:id', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own signatures
        }

        var updateDoc = function(rec) {
            if (!rec || (rec.user.toJSON()) !== req.user.id) {
                return res.sendStatus(404);
            }

            if (rec.updatedAt.getTime() !== Date.parse(req.body.document.updatedAt)) {
                return res.sendStatus(409);
            }

            delete req.body.document.signatureRequest;

            rec.set(req.body.document);
            rec.save(utils.errorHandler(res, function(rec) {
                var json = rec.getPublicData();

                app.emit('audit', 'document.update', {
                    req: req,
                    data: rec.getAuditData()
                });

                app.emit('dbupdate', req, 'document', 'update', rec.id, json);

                res.json({
                    document: json
                });
            }));
        };

        mongoose.models.Document.findById(req.params.id, utils.errorHandler(res, updateDoc));
    });

    app['delete']('/api/v1.0/users/:userId/documents/:id', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own signatures
        }

        mongoose.models.Document.findById(req.params.id, utils.errorHandler(res, function(doc) {
            if (!doc || (doc.user.toJSON()) !== req.user.id) {
                return res.sendStatus(404);
            }

            doc.removeDocumentWithData(function(err) {
                if (err) {
                    return res.status(500).json({
                        message: err + ''
                    });
                }

                app.emit('audit', 'document.delete', {
                    req: req,
                    data: doc.getAuditData()
                });

                app.emit('dbupdate', req, 'document', 'delete', doc.id, null);

                req.user.updateMetricsOnDocumentRemove(req, app, doc);
                res.sendStatus(204);
            });
        }));
    });

    app.post('/api/v1.0/users/:userId/documents/:id', session.isAuthenticated, session.checkOwnerParam, function(req, res) {
        // Anonymous users are not allowed to print, download and send docs
        if (req.user.isAnonymous) {
            app.emit('ask-to-register', req.user._id);
            return res.status(403).json({
                message: 'Anonymous users are not allowed to print, download and send documents'
            });
        }

        if (!req.user.isEmailConfirmed && req.body.action !== 'sendSignature') {
            return res.status(403).json({
                message: strings.CONFIRM_EMAIL_MESSAGE
            });
        }

        var auditData = {};

        switch (req.body.action) {
            case 'clone':
                cloneDoc.clone(req.params.id, req.user.id, req.body.user || req.user.id, function(err, rec) {
                    if (err) {
                        res.status(400).json({
                            message: err + ''
                        });

                        return;
                    }

                    res.json({
                        documents: [rec.getPublicData()]
                    });
                });
                return;
            case 'sendSignature':
                signatureRequest.send(app, req.params.id, req.user, req, res);
                return;
            case 'signatureRequest':
                loadDefaultFolders(function(err) {
                    if (err) {
                        res.status(400).json({
                            message: err + ''
                        });

                        return;
                    }

                    signatureRequest.request(app, req.params.id, req.user, req.body, defaultFolders.inbox, req, res);
                });
                return;
            case 'requestPages':
                if (!req.body.pages || !req.body.pages.length) {
                    return res.status(400).json({
                        message: 'pages required'
                    });
                }

                mongoose.models.Task.update({
                    doc: req.params.id,
                    'config.page': {
                        $in: req.body.pages
                    }
                }, {
                    priority: 2
                }, {
                    multi: true
                }, utils.errorHandler(res, function() {
                    res.sendStatus(201);
                }));

                return;
            case 'print':
                utils.createPdfTask(req, res, 'print', {
                    password: req.body.password
                }, function(rec) {
                    var name = req.body.isDownload ? 'document.download' : 'document.print';

                    app.emit('audit', name, {
                        req: req,
                        data: rec.getAuditData()
                    });
                });
                return;
            case 'email':
                req.body.email.inviteId = req.user.inviteId;
                _.assign(auditData, req.body.email);

                utils.createPdfTask(req, res, 'email', req.body.email, function(rec) {
                    var data = rec.getAuditData();
                    data.email = auditData;

                    app.emit('audit', 'document.email', {
                        req: req,
                        data: data
                    });
                });
                return;
            case 'fax':
                _.assign(auditData, req.body.fax);

                utils.createPdfTask(req, res, 'fax', req.body.fax, function(rec) {
                    var data = rec.getAuditData();
                    data.fax = auditData;

                    app.emit('audit', 'document.fax', {
                        req: req,
                        data: data
                    });
                });
                return;
        }

        res.status(400).json({
            message: 'Unknown action ' + req.body.action
        });
    });

    app.get('/api/v1.0/users/:userId/documents/:documentId/pages', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own signatures
        }

        var sendResult = function(pages) {
            res.json({
                pages: pages
            });
        };

        mongoose.models.Page.find({
            doc: req.params.documentId
        }, utils.errorHandler(res, sendResult));
    });

    app.post('/api/v1.0/users/:userId/documents/:documentId/pages', session.isAuthenticated, function(req, res) {
        if (req.user.id !== req.params.userId) {
            return res.sendStatus(404); // can query only own signatures
        }

        mongoose.models.Document.findById(req.params.documentId, utils.errorHandler(res, function(rec) {
            if (!rec || (rec.user.toJSON()) !== req.user.id) {
                return res.sendStatus(404);
            }

            storage.ensureCache(rec.fileKey, rec.storageBucket, rec.storageRegion);

            mongoose.models.Task.create({
                type: 'scan',
                user: req.user.id,
                doc: rec.id,
                priority: 2,
                status: 'ready',
                config: {
                    page: req.body.page.i,
                    documentKey: rec.fileKey,
                    documentRegion: rec.storageRegion,
                    documentBucket: rec.storageBucket
                }
            }, function(err) {
                if (err) {
                    winston.error('Failed to create task for page %s in doc %s.', req.body.page.i + '', rec.id);
                    winston.error(err + '');

                    return res.status(500).json({
                        message: err + ''
                    });
                }

                utils.notifyAboutNewTask();

                res.json({
                    message: 'Page scan queued'
                });
            });
        }));
    });

    app.put('/api/v1.0/users/:userId/documents/:documentId/pages/:id', session.isAuthenticated, session.checkOwnerParam, function(req, res) {
        var doc,
            page,
            responseSent = false,
            update = function() {
                if (doc && page) {
                    page.set(req.body.page);

                    page.save(utils.errorHandler(res, function(page) {
                        doc.compositeUpdatedAt = page.updatedAt;

                        doc.save(utils.errorHandler(res, function(doc) {
                            app.emit('audit', 'document.update', {
                                req: req,
                                data: doc.getAuditData()
                            });

                            app.emit('audit', 'page.update', {
                                req: req,
                                data: {
                                    id: page.id,
                                    doc: req.params.documentId,
                                    docName: doc.name,
                                    docFileName: doc.fileName,
                                    page: page.i
                                }
                            });

                            app.emit('dbupdate', req, 'document', 'update', doc.id, doc.getPublicData());
                            app.emit('dbupdate', req, 'page', 'update', page.id, page.toJSON());

                            res.json({
                                documents: [doc.getPublicData()],
                                pages: [page]
                            });
                        }));
                    }));
                }
            };

        mongoose.models.Page.findById(req.params.id, utils.errorHandler(res, function(rec) {
            if (!rec || rec.doc.toJSON() !== req.params.documentId) {
                if (responseSent) {
                    return;
                }

                responseSent = true;
                return res.sendStatus(404);
            }

            var skipConflicts = config.skipConflictsKey && req.query.skipConflictCheck === config.skipConflictsKey;

            if (!skipConflicts && rec.updatedAt.getTime() !== Date.parse(req.body.page.updatedAt)) {
                if (responseSent) {
                    return;
                }

                responseSent = true;
                return res.sendStatus(409);
            }

            page = rec;
            update();
        }));

        mongoose.models.Document.findById(req.params.documentId, utils.errorHandler(res, function(rec) {
            if (!rec) {
                if (responseSent) {
                    return;
                }

                responseSent = true;
                return res.sendStatus(404);
            }

            if (rec.signatureRequest) {
                if (rec.signatureRequest.to !== req.user.email) {
                    if (responseSent) {
                        return;
                    }

                    responseSent = true;
                    return res.sendStatus(403);
                }
            } else if (rec.user.toJSON() !== req.params.userId) {
                if (responseSent) {
                    return;
                }

                responseSent = true;
                return res.sendStatus(403);
            }

            doc = rec;
            update();
        }));
    });
};
