'use strict';

/*global PDFJS,md5*/
App.DocController = Ember.Controller.extend(Ember.Evented, {
    needs: [
        'application' // to get profile
    ],

    pdfExportService: null, // injected by the app
    pdfJsLoaderService: null, // injected
    pdfUrl: null, // for unit tests
    pdf: null, // keep PDF in parent controller, to prevent subsequent file downloads

    downloading: false,
    printing: false,
    sendingForm: false,
    status: '',

    sendType: '',

    queryParams: [{
        formId: 'form'
    }],

    formId: '',
    isForm: Ember.computed.notEmpty('formId'),
    docName: Ember.computed.oneWay('model.doc.name'),
    formRedirectMessage: '',
    hasRequiredFields: true,
    hasRequiredFieldsOrSendingForm: Ember.computed.or('hasRequiredFields', 'sendingForm'),

    paperjetBrandHost: function() {
        return App.get('paperjetBrandHost');
    }.property('App.paperjetBrandHost'),

    formOrSignatureRequest: function() {
        return !!this.get('formId') || !!this.get('model.doc.signatureRequest');
    }.property('form', 'doc.signatureRequest'),

    init: function() {
        this._super();
        this.set('pdfJsLoaderService.loaded', true); // PDFJS is already loaded because it's included in HTML

        if (App.get('socket')) { // null when we're editing shared form
            var socket = App.get('socket'),
                userId = App.get('userId');

            socket.on('metrics.update', _.bind(this.onMetricsUpdated, this));
            socket.on('ask-to-register', _.bind(this.showRegisterModal, this));
        }
    },

    actions: {
        submitSignature: function() {
            if (this.get('hasRequiredFieldsOrSendingForm')) {
                return;
            }

            var url = sprintf('/api/v1.0/users/%s/documents/%s', App.get('userId'), this.get('model.doc.id'));
            this.submitFormOrSignature(url, 'sendSignature', '/dashboard/documents');
        },

        submitForm: function(to, cc, subject, message) {
            if (this.get('hasRequiredFieldsOrSendingForm')) {
                return;
            }
            
            var url = sprintf('/api/v1.0/documents/%s/forms/%s', this.get('model.doc.id'), this.get('model.form.id'));
            this.submitFormOrSignature(url, 'sendForm', this.get('model.form.redirectUrl'), to, cc, subject, message);
        },

        showSendDialog: function(type) {
            // perform this checking on front end to avoid superfluous requests to the server,
            // but a hacker can easily set isAnonymous to false using chrome console, so the same checking must be
            // added on back-end too
            if (this.get('controllers.application.model.profile.isAnonymous')) {
                return this.showRegisterModal();
            }
            if (!this.get('controllers.application.model.profile.isEmailConfirmed')) {
                return App.showError(App.CONFIRM_EMAIL_MESSAGE);
            }

            this.set('sendType', type); // todo: move to showSendDialog event
            this.trigger('showSendDialog');
        },

        download: function(params) {
            if (this.get('controllers.application.model.profile.isAnonymous')) {
                return this.showRegisterModal();
            }

            if (!this.get('controllers.application.model.profile.isEmailConfirmed')) {
                return App.showError(App.CONFIRM_EMAIL_MESSAGE);
            }

            if (!this.get('downloading')) {
                var printAndDownload = _.bind(function() {
                        App.showNotification('Preparing your download', true);
                        this.pdfExportService.savePrintedPdf(this.get('content.doc'), this.get('content.pages'), true, params ? params.password : null,
                            _.bind(function(err, printUrl) {
                                this.set('downloading', false);

                                if (err) {
                                    App.showError(err);
                                } else {
                                    window.location = printUrl;
                                }
                            }, this));
                    }, this),
                    args = {
                        cancel: false,
                        callback: printAndDownload
                    };

                this.set('downloading', true);
                this.trigger('export', args); // TODO: test

                if (!args.cancel) {
                    printAndDownload();
                }
            }
        },

        print: function() {
            if (this.get('controllers.application.model.profile.isAnonymous')) {
                return this.showRegisterModal();
            }
            if (!this.get('controllers.application.model.profile.isEmailConfirmed')) {
                return App.showError(App.CONFIRM_EMAIL_MESSAGE);
            }

            if (!this.get('printing')) {
                var printInBrowser = _.bind(function() {
                        App.showNotification('Printing your document', true);
                        this.pdfExportService.printInBrowser(this.get('model.doc'), this.store, _.bind(function() {
                            this.set('printing', false);
                        }, this));
                    }, this),
                    args = {
                        cancel: false,
                        callback: printInBrowser
                    };

                this.set('printing', true);
                this.trigger('export', args);

                if (!args.cancel) {
                    printInBrowser();
                }
            }
        },

        logout: function() {
            this.set('loggingOut', true);

            var request = $.ajax({
                type: 'DELETE',
                url: '/api/v1.0/connection'
            });

            request.done(function() {
                location.href = '/';
            });

            request.fail(_.bind(function() {
                this.set('loggingOut', false);
                App.showError('Logout failed');
            }, this));
        },

        profileUpdate: function(json) {
            var type = this.store.modelFor('user'),
                serializer = this.store.serializerFor(type.typeKey),
                record = serializer.extractSingle(this.store, type, {
                    users: [json]
                });

            this.set('controllers.application.model.profile', this.store.push('user', record));
        },

        register: function() {
            // trigger form sumbit to call RegistrationFromComponent's logic
            $('#registration-form').submit();
        },

        //action from RegFormComponent
        registerFormAction: function(data) {
            if (data.action == 'setIsProcessingStatus') {
                this.setProperties({
                    isRegProcessing: data.isProcessing
                });
            } else if (data.action === 'regDone') {
                this.store.pushPayload({
                    users: [data.user]
                });

                $('#register-modal').on('hidden.bs.modal', function(e) { // FIX: RegisterModal component should handle this logic, and fire appropriate events
                    App.showNotification('Thank you for registration! Please check your email to complete registration.');
                });
                $('#register-modal').modal('hide');
            }
        }
    },

    submitFormOrSignature: function(url, action, redirectUrl, to, cc, subject, message) {
        if (!this.get('sendingForm')) {
            var onFormSent = function() {
                    var start;

                    this.setProperties({
                        sendingForm: false,
                        formRedirectMessage: redirectUrl ? 'Redirecting in 3 seconds...' : 'You may close the window.'
                    });

                    if (redirectUrl) {
                        start = Date.now();

                        setInterval(_.bind(function() {
                            this.set('formRedirectMessage', sprintf('Redirecting in %s seconds...', Math.round(3 - (Date.now() - start) / 1000)));

                            if (Date.now() - start > 3000) { // 3 sec
                                window.location = redirectUrl;
                            }
                        }, this), 1000);
                    }

                    $('#form-sent-modal').modal({
                        keyboard: false,
                        backdrop: 'static'
                    });
                },
                sendForm = function(pdf) {
                    $.ajax({
                        url: url,
                        type: 'POST',
                        data: JSON.stringify({
                            action: action,
                            to: to,
                            cc: cc,
                            subject: subject,
                            message: message,
                            pdf: pdf
                        }),
                        contentType: 'application/json',
                        cache: false,
                        dataType: 'json',
                        context: this,
                        processData: false, // Don't process the files
                        success: onFormSent,
                        error: function(xhr, textStatus, errorThrown) {
                            if (xhr.status === 200) {
                                onFormSent.call(this);
                            } else {
                                var message = 'Failed to send form';

                                if (xhr.responseText) {
                                    try {
                                        message = JSON.parse(xhr.responseText).message;
                                    } catch (e) {}
                                }

                                this.set('sendingForm', false);
                                App.showError(message);
                            }
                        }
                    });
                },
                submit = _.bind(function() {
                    this.pdfExportService.exportPages(this.get('model.doc'), this.get('model.pages'), sendForm, this);
                }, this),
                args = {
                    cancel: false,
                    callback: submit
                };

            App.showNotification('Preparing your form', true);
            this.set('sendingForm', true);
            this.trigger('export', args);

            if (!args.cancel) {
                submit();
            }
        }
    },

    showRegisterModal: function() {
        if (!$('.modal.in').length && this.get('controllers.application.model.profile.isAnonymous')) {
            $('#register-modal').modal('show');
        }
    },

    onMetricsUpdated: function(receivedData) {
        this.set('controllers.application.model.profile.metrics', receivedData.data);
    },

    gravatarProfileBackgroundStyle: function() {
        return sprintf('background-image:url(//secure.gravatar.com/avatar/%s?d=%s);',
            md5(this.get('controllers.application.model.profile.email')),
            encodeURIComponent(window.location.origin + "/images/user-profile.png")
        ).htmlSafe();
    }.property('controllers.application.model.profile.email')
});
