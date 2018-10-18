'use strict';

/*global App, Ember, $, _*/
App.EditableTextView = Ember.View.extend({
    templateName: 'views/editable-text',
    classNames: ['editable-text-inactive'],
    isEditing: false,
    record: null,
    isCancelled: false,
    initialText: '',

    actions: {
        apply: function() {
            this.saveChanges();
        }
    },

    click: function(e) {
        // do not bubble up click on the input field or Apply icon
        var el = $(e.target);

        if (el.is('input') || el.is('button')) {
            e.preventDefault();
            e.stopPropagation();
        }
    },

    focusOut: function(e) {
        var el = e.relatedTarget ? $(e.relatedTarget) : null;

        if (el && el.is('button') && el.parents('#' + this.elementId).length) {
            this.saveChanges();
        } else {
            this.set('isEditing', false);
        }
    },

    keyPress: function(e) {
        var ENTER_KEY_CODE = 13;
        if (e.which === ENTER_KEY_CODE) {
            this.saveChanges();
        }
    },

    saveChanges: function() {
        var rec = this.get('record'),
            editedPropertyName = this.get('editedPropertyName'),
            text = this.get('inputText');

        this.set('isEditing', false);
        rec.set(editedPropertyName, text);

        if (rec.get('isDirty')) {
            var onError = function(xhr) {
                if (rec.get('isDirty')) {
                    rec.rollback();
                }

                App.showError('Error: ' + xhr.statusText + '. Please reload the page');
                Ember.onerror(xhr);
            };

            rec.save().then(null, function(xhr) {
                if (xhr.status === 409) {
                    rec.reload().then(function() { // reload rec to prevent conflicts
                        rec.set(editedPropertyName, text);

                        if (rec.get('isDirty')) {
                            rec.save().then(null, onError);
                        }
                    });
                } else {
                    onError(xhr);
                }
            });
        }
    },

    keyUp: function(e) {
        if (e.which === $.ui.keyCode.ESCAPE) {
            this.set('isEditing', false);
        }
    },

    onIsEditingChanged: function() {
        if (this.get('isEditing')) {
            $(this.element).addClass('editable-text');

            this.setProperties({
                'inputText': this.get('text'),
                'initialText': this.get('text'),
                'isCancelled': false
            });

            Ember.run.scheduleOnce('afterRender', this, function() {
                $('#' + this.elementId + ' input').focus();
            });
        } else {
            $(this.element).removeClass('editable-text');
        }
    }.observes('isEditing'),

    onIsCancelledChanged: function() {
        //rollback text if editing was cancelled
        if (this.get('isCancelled')) {
            this.set('text', this.get('initialText'));
        }
    }.observes('isCancelled')
});
