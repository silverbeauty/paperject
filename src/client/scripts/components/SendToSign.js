'use strict';
/*global Ladda*/

App.SendToSignComponent = Ember.Component.extend({
    docId: '',
    docName: '',
    subject: '',
    pages: null,
    to: '',
    message: '',
    signaturesCount: 0,
    isTemplate: false,

    didInsertElement: function() {
        this.set('submitSpinner', Ladda.create(this.$('.js-btn-send')[0]));

        $('textarea.js-auto-size').textareaAutoSize();

        // init form validation plugin
        this.$('form').validate({
            rules: {
                to: {
                    required: true,
                    multiemail: true
                },
                subject: {
                    required: true
                }
            },

            highlight: function(label) {
                $(label).closest('.form-group').addClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').removeClass('hidden');
            },

            unhighlight: function(label) {
                $(label).closest('.form-group').removeClass('has-error');
                $(label).closest('.form-group').find('.form-control-feedback').addClass('hidden');
            },

            errorPlacement: function(error, element) {
                $(element).closest('.form-group').find('.form-control-feedback').tooltip().prop('title', $(error).text());
            },

            submitHandler: _.bind(this.submitForm, this)
        });

        $('#send-to-sign').on('shown.bs.modal', _.bind(function() {
            var count = 0;

            this.get('pages').forEach(function(page) {
                page.get('objects').forEach(function(obj) {
                    if (obj.type === 'signature' && obj.request) {
                        ++count;
                    }
                });
            });

            this.set('signaturesCount', count);
            this.set('subject', 'Please sign ' + this.get('docName'));
        }, this));
    },

    submitForm: function() {
        this.set('errorMessage', '');
        this.get('submitSpinner').start();

        var pages = [];

        this.get('pages').forEach(function(page) {
            pages.push(page.toJSON());
        });

        $.ajax({
            url: sprintf('/api/v1.0/users/%s/documents/%s', App.get('userId'), this.get('docId')),
            type: 'POST',
            data: JSON.stringify({
                action: 'signatureRequest',
                to: this.get('to'),
                subject: this.get('subject'),
                message: this.get('message'),
                appUrl: location.origin,
                pages: pages
            }),
            contentType: 'application/json',
            cache: false,
            dataType: 'json',
            context: this,
            processData: false, // Don't process the files
            success: this.onSent,
            error: function(xhr, textStatus, errorThrown) {
                if (xhr.status === 200) {
                    this.onSent();
                } else {
                    var message = 'Failed to send document';

                    if (xhr.responseText) {
                        try {
                            message = JSON.parse(xhr.responseText).message;
                        } catch (e) {}
                    }

                    this.set('errorMessage', message);
                    this.get('submitSpinner').stop();
                }
            }
        });
    },

    onSent: function() {
        this.get('submitSpinner').stop();
        $('#send-to-sign').modal('hide');

        if (this.get('isTemplate')) {
            location.href = '/dashboard/';
        }
    }
});
