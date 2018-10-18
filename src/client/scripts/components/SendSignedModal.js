'use strict';
/*global Ladda*/

App.SendSignedModalComponent = Ember.Component.extend({
    docName: '',
    subject: '',
    to: '',
    cc: '',
    message: '',

    didInsertElement: function() {
        $('textarea.js-auto-size').textareaAutoSize();

        // init form validation plugin
        this.$('form').validate({
            rules: {
                to: {
                    required: true,
                    multiemail: true
                },
                cc: {
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

        $('#send-signed-modal').on('shown.bs.modal', _.bind(function() {
            this.set('subject', this.get('docName'));
        }, this));
    },

    submitForm: function() {
        $('#send-signed-modal').modal('hide');
        this.sendAction('submit', this.get('to'), this.get('cc'), this.get('subject'), this.get('message'));
    }
});
