'use strict';

/*global Ladda*/
App.DocSendComponent = Ember.Component.extend({
    store: null,
    user: null,
    doc: null,
    pages: null,
    activeTab: 'email', // email | fax | print | download
    visible: false, // to externally control visibility and to pass this value to child components
    sendOnly: false,
    title: 'Export document',

    downloading: false,
    printing: false,
    counter: null,

    emailActive: Ember.computed.equal('activeTab', 'email'),
    faxActive: Ember.computed.equal('activeTab', 'fax'),
    printActive: Ember.computed.equal('activeTab', 'print'),
    downloadActive: Ember.computed.equal('activeTab', 'download'),

    faxVisible: Ember.computed.and('faxActive', 'visible'),

    encryptDownload: false,
    downloadPassword: '',
    downloadPasswordConfirm: '',
    downloadDisabled: false,

    actions: {
        docSent: function() {
            $('#doc-send').modal('hide');
        },

        download: function() {
            var params = {};

            if (this.get('encryptDownload') && this.get('downloadPassword').trim().length) {
                params.password = this.get('downloadPassword');
            }

            this.sendAction('download', params);
        },

        print: function() {
            this.sendAction('print');
        }
    },

    startCountdown: function() {
        if (this.get('printActive') || this.get('downloadActive')) {
            var start = Date.now(),
                selector = '#doc-send-tab-' + this.get('activeTab') + ' .btn-primary .js-message',
                format = this.get('printActive') ? 'Print (%s)' : 'Download (%s)',
                countdownFn = function() {
                    var seconds = 3 - Math.floor((Date.now() - start) / 1000);

                    if (seconds <= 0) {
                        this.sendAction(this.get('printActive') ? 'print' : 'download');
                    } else {
                        $(selector).text(sprintf(format, seconds));
                        this.counter = Ember.run.later(this, countdownFn, 1000);
                    }
                };

            countdownFn.call(this);
        }
    },

    stopCountdown: function() {
        $('#doc-send-tab-download .btn-primary .js-message').text('Download');
        $('#doc-send-tab-print .btn-primary .js-message').text('Print');
        Ember.run.cancel(this.counter);
    }.observes('encryptDownload'),

    initPasswordValidation: function() {
        if (this.get('encryptDownload')) {
            Ember.run.scheduleOnce('afterRender', this, function() {
                var enableDownload = _.bind(function(validator) {
                    validator.checkForm();
                    this.set('downloadDisabled', !validator.valid());
                }, this);

                $('#download-password-form').validate({
                    rules: {
                        downloadPassword: {
                            required: true,
                            simplifiedPassword: true,
                            minlength: 6
                        },
                        downloadPasswordConfirm: {
                            required: true,
                            equalTo: '#' + this.get('downloadPasswordField.elementId')
                        }
                    },
                    highlight: function(label) {
                        enableDownload(this);
                        $(label).closest('.form-group').addClass('has-error');
                        $(label).closest('.form-group').find('.form-control-feedback').removeClass('hidden');
                    },
                    unhighlight: function(label) {
                        enableDownload(this);
                        $(label).closest('.form-group').removeClass('has-error');
                        $(label).closest('.form-group').find('.form-control-feedback').addClass('hidden');
                    },
                    errorPlacement: function(error, element) {
                        $(element).closest('.form-group').find('.form-control-feedback').tooltip().prop('title', $(error).text());
                    }
                });
            });
        }
    }.observes('encryptDownload'),

    didInsertElement: function() {
        this._super();

        $('#doc-send a[data-toggle="tab"]').on('shown.bs.tab', _.bind(function(e) {
            this.set('activeTab', e.target.id.substr('doc-send-tab-link-'.length));
            this.stopCountdown();
        }, this));

        $('#doc-send').on('show.bs.modal', _.bind(function(e) {
            this.setProperties({
                encryptDownload: false,
                downloadPassword: '',
                downloadPasswordConfirm: ''
            });

            if ($(e.target).attr('id') === 'doc-send') {
                this.set('visible', true);
                Ember.run.scheduleOnce('afterRender', this, this.startCountdown); // run in next cycle to ensure that properties are bound
            }
        }, this));

        $('#doc-send').on('hidden.bs.modal', _.bind(function(e) {
            if ($(e.target).attr('id') === 'doc-send') {
                this.set('visible', false);
                this.stopCountdown();
            }
        }, this));

        var spinnerDownload = Ladda.create($('#doc-send-tab-download button')[0]);

        this.addObserver('downloading', this, function() {
            if (this.get('downloading')) {
                spinnerDownload.start();
            } else {
                $('#doc-send').modal('hide');
                spinnerDownload.stop();
            }
        });

        var spinnerPrint = Ladda.create($('#doc-send-tab-print button')[0]);

        this.addObserver('printing', this, function() {
            if (this.get('printing')) {
                spinnerPrint.start();
            } else {
                $('#doc-send').modal('hide');
                spinnerPrint.stop();
            }
        });

    }
});
