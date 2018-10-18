App.PageEditor = Ember.Object.extend(Ember.Evented, {
    // injected
    i: -1,
    el: null,
    page: null,
    defaultObjectSize: 0,

    // private
    selectPrefix: '',
    visible: false,

    canvasPadding: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    canvasMarginTop: 0,
    canvasMarginLeft: 0,

    rendered: false,
    attachPageObjectsListenersTimer: null,

    selectedObjectId: -1,
    lastCreatedObjectId: -1,

    pendingChanges: [],
    applyChangesTimer: null,

    positionUpdateTimers: {}, // set of timeouts to throttle position update for individual elements. Need set of timeouts to prevent conflicts when

    formRequiredFields: {},
    requiredFieldsLoaded: false,

    lastFont: '',
    scanError: false,

    RESIZE_HANDLER_SIZE_THRESHOLD: 16,

    _REQUEST_IMAGES: [ // for grunt usemin task
        'signature-request1.png',
        'signature-request2.png',
        'initials-request1.png',
        'initials-request2.png'
    ],

    documentEditingEnabled: function() {
        return this.get('visible') && this.get('rendered') && this.get('parent.documentEditingEnabled');
    }.property('visible', 'rendered', 'parent.documentEditingEnabled'),

    init: function() {
        this._super();

        // prevent sharing arrays in prototype
        this.setProperties({
            pendingChanges: [],
            positionUpdateTimers: {},
            formRequiredFields: {}
        });

        this.get('el').append('<div class="loading-container"><div class="page-loading-message text-center">' +
            '<div><i class="fa fa-spin fa-spinner"></i></div>' +
            '<div>Your document is being prepared...</div>' +
            '</div></div>');

        this.selectPrefix = '#' + this.get('el').attr('id') + ' ';

        var bodyKeydownHandler = _.bind(this.onKeyDown, this),
            windowResizeHandler = _.bind(this.onWindowResize, this),
            el = this.get('el');

        this.addObserver('visible', this, function() {
            if (this.get('visible')) {
                $('body').on('keydown', bodyKeydownHandler);
                $(window).on('resize', windowResizeHandler);
            } else {
                $('body').off('keydown', bodyKeydownHandler);
                $(window).off('resize', windowResizeHandler);
            }
        });

        this.addObserver('rendered', this, function() {
            if (this.get('rendered')) {
                this.get('el').addClass('page-rendered');
            } else {
                this.get('el').removeClass('page-rendered');
            }
        });

        if (!this.get('parent.form') && !this.get('parent.doc.signatureRequest')) {
            el.click(_.bind(this.onMouseClick, this));
        }

        if (App.get('isNotMobileDevice')) {
            el.on('click', '.page-object-signature', _.bind(this.onFormSignatureClick, this));
            el.on('click', '.page-object-checkbox', _.bind(this.onCheckboxClick, this));
            el.mousedown(_.bind(this.selectPageObjectOnClick, this));
        } else {
            el.on('touchend', '.page-object-signature', _.bind(this.onFormSignatureClick, this));
            el.on('touchend', '.page-object-checkbox', _.bind(this.onCheckboxClick, this));
            el.on('touchend', _.bind(this.selectPageObjectOnClick, this));
        }

        el.on('focus', 'textarea,input', _.bind(this.selectInputOnFocus, this));

        el.on('change', '.page-object-field-input', _.bind(this.onTextChange, this));
        el.on('keyup', 'textarea', _.bind(this.onKeyUp, this));

        if (!this.get('parent.form') && !this.get('parent.doc.signatureRequest')) {
            el.mouseenter(function() {
                $('#document-tool-indicator').removeClass('document-tool-indicator-inactive');
            });

            el.mouseleave(function() {
                $('#document-tool-indicator').addClass('document-tool-indicator-inactive');
            });
        }

        this.attachParentEvents();
    },

    attachParentEvents: function() {
        var docEditor = this.get('parent');

        docEditor.on('select', this, function(editor) {
            if (editor !== this) {
                this.set('selectedObjectId', -1);
                this.get('el').find('.selected').removeClass('selected');
            }
        });

        docEditor.on('set-selected-object-style', this, this.setSelectedObjectStyle);

        docEditor.on('set-selected-object-font', this, function(font) {
            if (this.get('selectedObjectId') !== -1) {
                switch (font) {
                    case 'Helvetica':
                        font = 'Helvetica, sans-serif';
                        break;
                        // case 'Arial':
                        //     font = 'Arial, sans-serif';
                        //     break;
                    case 'Times':
                        font = 'Times, serif';
                        break;
                        // case 'Tahoma':
                        //     font = 'Tahoma, Geneva, sans-serif';
                        //     break;
                    case 'Courier':
                        font = 'Courier, monospace';
                        break;
                    default:
                        font = 'Helvetica, sans-serif';
                        break;
                }

                if (this.get('selectedObjectId') === this.get('lastCreatedObjectId')) {
                    this.set('lastFont', font);
                }

                this.addChange(this.edits.setObjectStyle, this.get('selectedObjectId'), 'fontFamily', font);
            }
        });

        docEditor.on('set-selected-object-size', this, function(ratio) {
            if (this.get('selectedObjectId') !== -1) {
                this.addChange(this.edits.adjustObjectSize, this.get('selectedObjectId'), ratio);
            }
        });

        docEditor.on('page-update', this, function(id) {
            if (this.get('page.id') === id) {
                this.renderPage(true);

                if (this.get('selectedObjectId') !== -1 && !this.get('selectedObject')) {
                    this.set('selectedObjectId', -1);
                }
            }
        });

        docEditor.on('add-form-signature', this, this.addFormSignature);

        if (this.get('parent.doc.signatureRequest')) {
            docEditor.on('add-form-signature', this, this.saveFormSignature);
        }

        docEditor.on('set-required-fields', this, this.setRequiredFieldsOnValidation);
        docEditor.on('show-required-signature-request', this, this.showRequiredSignatureRequestOnValidation);

        docEditor.addObserver('mobileZoom', this, function() {
            Ember.run.scheduleOnce('afterRender', _.bind(this.onWindowResize, this));
        });
    },

    setRequiredFieldsOnValidation: function(page, fields, required) {
        if (page === this.get('i')) {
            _.each(fields, function(id) {
                var el = this.el.find('[data-page-object-id=' + id + ']'),
                    hasValue = false,
                    object = this.getObject(id);

                this.formRequiredFields[id] = required;

                if (object.get('type') === 'checkbox') {
                    hasValue = object.get('check');
                } else if (object.get('type') === 'multicell' || object.get('type') === 'field') {
                    hasValue = _.isString(object.get('text')) && object.get('text').length;
                } else if (object.get('request')) {
                    hasValue = object.get('edited');
                }

                this.setRequiredField(id, required && !hasValue);

                if (required && !hasValue) {
                    el.addClass('page-object-required');
                    this.setRequiredIndicatorPosition(this.getObject(id));
                } else {
                    el.removeClass('page-object-required');
                }

                this.showFirstRequiredArrowAtGroup(object);
            }, this);
        }
    },

    showRequiredSignatureRequestOnValidation: function(page, id, show) {
        if (page === this.get('i')) {
            this.setRequiredField(id, show);

            var object = this.getObject(id);

            if (object.get('request')) {
                if (show) {
                    if (!object.get('edited')) {
                        this.el.find('[data-page-object-id=' + id + ']').addClass('page-object-required');
                    }

                    this.setRequiredField(id, !object.get('edited'));
                    this.el.find('[data-page-object-id=' + id + ']').show();
                } else {
                    this.el.find('[data-page-object-id=' + id + ']').removeClass('page-object-required');
                }

                this.showFirstRequiredArrowAtGroup(object);
            }
        }
    },

    saveFormSignature: function(signature) {
        var obj = this.get('selectedObject');

        if (obj && obj.get('type') === 'signature') {
            this.get('parent.store').createRecord('signature', {
                img: signature.img, // this is always PNG format
                h: signature.h,
                w: signature.w,
                type: obj.get('request') || obj.get('type') || 'signature'
            }).save();
        }
    },

    addFormSignature: function(signature) {
        var obj = this.get('selectedObject');

        if (obj && obj.get('type') === 'signature') {
            this.setFormSignature(obj, signature);

            var context = {
                count: 0
            };

            this.get('parent').trigger('set-empty-form-signatures', signature, obj.request, context);

            if (context.count) {
                App.showNotification(sprintf('We have used your %s to fill %s additional field(s)', obj.request, context.count), true);
            }
        }
    },

    setFormSignature: function(object, signature) {
        if (this.formRequiredFields[object.id]) {
            this.setRequiredField(object.id, false);
            this.el.find('[data-page-object-id=' + object.id + ']').removeClass('page-object-required').removeClass('page-object-signature-request');
            this.showFirstRequiredArrowAtGroup(object);
        }

        object.edited = true;

        if (!object.config) {
            object.config = {
                imgH: object.imgH,
                imgW: object.imgW,
                h: object.h,
                w: object.w,
                x: object.x,
                y: object.y
            };
        }

        var data = {
            img: signature.img,
            imgH: signature.h,
            imgW: signature.w,
            h: object.config.h,
            w: object.config.w,
            x: object.config.x,
            y: object.config.y
        };

        // keep width and adjust height
        data.h = object.config.w * data.imgH / data.imgW;

        if (data.h > object.config.h) {
            var ratio = object.config.h / data.h;
            data.h *= ratio;
            data.w *= ratio;
        }

        data.x += (object.config.w - data.w) / 2;
        data.y += (object.config.h - data.h) / 2;
        this.addChange(this.edits.updateObject, object.id, data);
    },

    removeLastCreatedEmptyField: function() {
        if (this.get('parent.doc.isTemplate')) {
            return;
        }

        var id = this.get('lastCreatedObjectId'),
            object = this.getObject(id);

        // undefined means that field was not edited
        if (id !== this.get('selectedObjectId') && object && object.get('type') === 'field' && _.isUndefined(object.get('text'))) {
            var htmlVal = $(this.selectPrefix + '[data-page-object-id=' + object.id + '] textarea').val();

            // double-check value in the HTML element, in case if onTextChange is not triggered yet
            if (!htmlVal.length) {
                this.addChange(this.edits.removeObjectById, id);
            }
        }
    }.observes('selectedObjectId'),

    // group all available Change operations
    edits: {
        removeObjectById: function(id) {
            var object = this.getObject(id);

            if (object) {
                this.get('page.objects').removeObject(object);

                if (id === this.get('lastCreatedObjectId')) {
                    this.set('lastCreatedObjectId', -1);
                }

                if (this.get('selectedObjectId') === id) {
                    this.set('selectedObjectId', -1);
                }

                $(this.selectPrefix + '[data-page-object-id=' + id + ']').remove();
            }
        },

        addObject: function(obj) {
            obj.id = this.get('page.nextObjectId');
            this.set('page.nextObjectId', this.get('page.nextObjectId') + 1);
            this.removeLastCreatedEmptyField();
            this.set('lastCreatedObjectId', obj.id);
            obj = Ember.Object.create(obj);
            this.get('page.objects').pushObject(obj);

            // create DOM
            this.createPageObject(obj);

            var el = this.get('el').find('[data-page-object-id=' + obj.id + ']');
            this.applyPageObjectPositionAndStyle(el, obj, obj.id + 1);
            this.attachPageObjectListeners(el, obj);
            this.selectPageObject(el, true);

            $('#document-tool-indicator').css('opacity', 0);
        },

        setObjectStyle: function(id, property, value, toggleValue) {
            var object = this.getObject(id);

            if (object) {
                if (!object.get('style')) {
                    object.set('style', Ember.Object.create({}));
                }

                if (toggleValue && object.get('style.' + property) === value) {
                    value = toggleValue;
                }

                if (object.type === 'checkbox') {
                    object.set('check', !!object.get('check')); // undefined means that it was not touched yet
                }

                object.set('style.' + property, value);
                this.onObjectStyleUpdated(object);
            }
        },

        adjustObjectSize: function(id, ratio) {
            var object = this.getObject(id);

            if (object) {
                var h = parseInt(object.get('h'), 10),
                    type = object.get('type'),
                    diff = h - h * ratio,
                    bottom = object.get('y') + object.get('h');

                if (ratio > 1 || (h * ratio > this.get('defaultObjectSize') / 1.5)) { // ensure min size
                    if (object.get('fontSize')) {
                        object.set('fontSize', object.get('fontSize') * ratio);

                        if (object.get('fontSize') > object.get('h')) {
                            object.set('h', object.get('fontSize'));
                            object.set('fontSize', null);
                        }
                    } else {
                        object.set('h', h * ratio);
                    }

                    if (type === 'checkbox' || type === 'rect' || type === 'signature') {
                        var w = parseInt(object.get('w'), 10);
                        object.set('w', w * ratio);
                    }

                    if (object.type === 'checkbox') {
                        object.set('check', !!object.get('check')); // undefined means that it was not touched yet
                    }

                    this.onObjectStyleUpdated(object); // it will update object height, based on the font size and number of rows
                    object.set('y', bottom - object.get('h')); // keep bottom position consistent
                    this.onObjectStyleUpdated(object); // apply bottom position
                }
            }
        },

        updateObject: function(id, data) {
            var object = this.getObject(id);

            if (object) {
                var hasChanges = false;

                for (var prop in data) {
                    if (data.hasOwnProperty(prop)) {
                        if (_.isObject(data[prop]) || object.get(prop) !== data[prop]) {
                            hasChanges = true;
                            break;
                        }
                    }
                }

                if (hasChanges) {
                    if (object.type === 'checkbox') {
                        data.check = !!object.get('check'); // undefined means that it was not touched yet
                    }

                    object.setProperties(data);
                    this.onObjectStyleUpdated(object);
                }
            }
        }
    },

    attachPageObjectListeners: function(el, object) {
        if (object.type === 'field') {
            el.children('textarea').autoGrowInput({
                minWidth: 20,
                comfortZone: 20
            }).on('autoGrow', _.bind(this.onAutoGrow, this));
        }

        if (!this.get('parent.form') && !this.get('parent.doc.signatureRequest')) {
            if (object.type !== 'signature') {
                el.draggable({
                    containment: 'parent',
                    stop: _.bind(this.pageObjectPositionChangedByPlugin, this),
                    handle: '.po-tool-move,.po-inline-handle'
                });
            } else {
                el.draggable({
                    containment: 'parent',
                    stop: _.bind(this.pageObjectPositionChangedByPlugin, this)
                });
            }

            if (object.type === 'field' || object.type === 'multicell') { // rect
                el.resizable({
                    handles: 'e, w',
                    stop: _.bind(this.pageObjectPositionChangedByPlugin, this)
                });

                // if (object.type === 'rect') {
                //     this.resizeNewRectangle(el);
                // }
            } else if (object.type === 'checkbox') {
                el.resizable({
                    handles: 'n, e, s, w, se',
                    aspectRatio: 1,
                    stop: _.bind(this.pageObjectPositionChangedByPlugin, this)
                });
            } else if (object.type === 'signature') {
                el.resizable({
                    handles: 'n, e, s, w, se, sw, ne, nw',
                    aspectRatio: object.imgW / object.imgH,
                    stop: _.bind(this.pageObjectPositionChangedByPlugin, this)
                });
            }
        }

        el.children('.page-object [title]').tooltip();
    },

    onMouseClick: function(e) {
        if (this.get('resizing') || !this.get('documentEditingEnabled') || !App.get('isNotMobileDevice')) {
            return;
        }

        var target = $(e.target);

        if (target.hasClass('po-tool-del')) {
            this.addChange(this.edits.removeObjectById, this.get('selectedObjectId'));
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (target.hasClass('po-inline-handle') && target.parents('.page-object-move').length) {
            this.exitMoveObjectMode();
            target.parents('.page-object').children('textarea,input').focus();
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (target.hasClass('po-tool-move')) {
            target = target.parents('.page-object');

            if (target.hasClass('page-object-move')) {
                target.removeClass('page-object-move');
            } else {
                this.exitMoveObjectMode();
                target.addClass('page-object-move');
                target.children('textarea,input').prop('disabled', true);
            }

            e.preventDefault();
            e.stopPropagation();
            return;
        }

        var activeTool = this.get('parent.activeTool');

        if (activeTool !== 'move') {
            if ((activeTool === 'signature' || (!target.hasClass('page-object') && !target.parents('.page-object').length)) &&
                target.id !== 'document-obj-properties' && !target.parents('#document-obj-properties').length &&
                target.id !== 'signature-info-bar' && !target.parents('#signature-info-bar').length &&
                activeTool !== 'cursor') {

                if (activeTool === 'signature' || activeTool === 'signature-request' || activeTool === 'initials-request') {
                    this.addSignature();
                } else {
                    var posFactor = this.get('parent.OBJECT_POS_FACTOR'),
                        pos = this.get('el').position(),
                        offsetX = 0,
                        offsetY = 0;


                    if (activeTool === 'text') {
                        offsetY = 10;
                    }

                    if (activeTool === 'checkbox') {
                        offsetX = 3;
                        offsetY = 7;
                    }

                    if (activeTool === 'rectangle') {
                        offsetY = 20;
                    }

                    this.addObjectOnClick(
                        posFactor * (e.pageX + offsetX - pos.left - this.get('canvasPadding') - this.get('canvasMarginLeft')) / this.get('canvasWidth'),
                        posFactor * (e.pageY + offsetY - pos.top - this.get('canvasPadding') - this.get('canvasMarginTop')) / this.get('canvasHeight')
                    );
                }

                e.preventDefault();
                e.stopPropagation();
            }
        }
    },

    addSignature: function() {
        var el = $('#document-tool-indicator'),
            pos = el.offset(),
            w = el.width() + 2,
            h = el.height() + 2,
            containerPos = this.get('el').position(),
            posFactor = this.get('parent.OBJECT_POS_FACTOR');

        this.addObjectOnClick(
            posFactor * (pos.left - 2 - containerPos.left - this.get('canvasPadding') - this.get('canvasMarginLeft')) / this.get('canvasWidth'),
            posFactor * (pos.top - 2 - containerPos.top - this.get('canvasPadding') - this.get('canvasMarginTop') + h) / this.get('canvasHeight'),
            posFactor * w / this.get('canvasWidth'),
            posFactor * h / this.get('canvasHeight')
        );
    },

    addObjectOnClick: function(x, y, w, h) {
        if (this.get('page')) {
            h = h || this.get('defaultObjectSize');

            var json = {
                    w: w || h / (this.get('page.w') / this.get('page.h')),
                    h: h,
                    x: x,
                    y: y - h,
                    style: Ember.Object.create({
                        color: '#000000'
                    })
                },
                selectedSignature,
                imageName;

            switch (this.get('parent.activeTool')) {
                case 'text':
                    json.type = 'field';

                    if (this.get('lastFont')) {
                        json.style = Ember.Object.create({
                            fontFamily: this.get('lastFont')
                        });
                    }
                    break;
                case 'checkbox':
                    json.type = 'checkbox';
                    json.check = true;
                    json.w = json.w * this.get('parent.CHECKBOX_SIZE_RATIO');
                    json.h = json.h * this.get('parent.CHECKBOX_SIZE_RATIO');
                    break;
                case 'rectangle':
                    json.w = 0;
                    json.h = 0;

                    json.fill = false;
                    json.type = 'rect';
                    break;
                case 'signature':
                    selectedSignature = this.get('parent.selectedSignature');
                    json.type = 'signature';
                    json.img = selectedSignature.get('img');
                    json.imgH = selectedSignature.get('h');
                    json.imgW = selectedSignature.get('w');
                    this.trigger('set-previous-active-tool');
                    break;
                case 'signature-request':
                    imageName = 'signature-request2.png'; // for Grunt usemin task
                    json.type = 'signature';
                    json.request = 'signature';
                    json.edited = false;
                    json.img = '../images/editor/' + imageName; // set name in case if we want to change the file in future
                    json.imgH = 100; // TODO: read it from image properties
                    json.imgW = 400;
                    this.trigger('set-previous-active-tool');
                    break;
                case 'initials-request':
                    imageName = 'initials-request2.png'; // for Grunt usemin task
                    json.type = 'signature';
                    json.request = 'initials';
                    json.edited = false;
                    json.img = '../images/editor/' + imageName; // set name in case if we want to change the file in future
                    json.imgH = 100; // TODO: read it from image properties
                    json.imgW = 400;
                    this.trigger('set-previous-active-tool');
                    break;
            }

            if (json.type) {
                this.addChange(this.edits.addObject, json);
            }
        }
    },

    show: function() {
        this.set('visible', true);
    },

    hide: function() {
        this.set('visible', false);
    },

    updateVisibility: function() {
        var el = this.get('el');

        if (this.get('visible')) {
            this.renderPage();
        } else {
            this.get('el').find('div.page-object').remove();
            this.get('el').find('img').remove();
            this.set('rendered', false);
        }
    }.observes('visible'),

    onKeyUp: function(e) {
        if (!this.get('documentEditingEnabled') || this.get('selectedObjectId') === -1 || $('.modal.fade.in').length ||
            this.get('parent.form') || this.get('parent.doc.signatureRequest')) {
            return;
        }

        var textareaEl = $(e.target),
            rows = this.getRowsNumber(textareaEl.val());

        if (textareaEl.attr('rows') !== rows + '') {
            textareaEl.attr('rows', rows);
            this.onAutoRowsGrow(textareaEl);
        }
    },

    getRowsNumber: function(str) {
        if (!_.isString(str)) {
            str = '';
        }

        return (str.match(/\n/g) || []).length + 1;
    },

    onKeyDown: function(e) {
        if (!this.get('documentEditingEnabled') || this.get('selectedObjectId') === -1 || $('.modal.fade.in').length) {
            return;
        }

        if (e.keyCode === $.ui.keyCode.ESCAPE) {
            if (this.get('el').find('.page-object-move').length) {
                this.exitMoveObjectMode();
            } else {
                this.trigger('set-active-tool-text');
                $('.navbar-doc-edit .btn').blur();
            }
        }

        if (!this.get('parent.form') && !this.get('parent.doc.signatureRequest')) {
            if (e.keyCode === $.ui.keyCode.LEFT || e.keyCode === $.ui.keyCode.UP || e.keyCode === $.ui.keyCode.RIGHT || e.keyCode === $.ui.keyCode.DOWN) {
                this.moveSelected(e);
            }

            if (!e.altKey && !e.shiftKey && (e.ctrlKey || e.metaKey) && (e.keyCode === 66 || e.keyCode === 73)) { // || e.keyCode === 85
                var input = this.get('el').find('.selected.page-object-field,.selected.page-object-multicell'),
                    update = false;

                if (input.length) {
                    switch (e.keyCode) {
                        case 66: // B - bold
                            this.setSelectedObjectStyle('fontWeight', 'bold', 'normal');
                            update = true;
                            break;
                        case 73: // I - italic
                            this.setSelectedObjectStyle('fontStyle', 'italic', 'normal');
                            update = true;
                            break;
                            // case 85: // U - underline
                            //     this.get('controller').send('setSelectedObjectStyle', 'textDecoration', 'underline', 'initial');
                            //     update = true;
                            //     break;
                    }
                }

                if (update) {
                    this.updatePropertyPanel();
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }
    },

    moveSelected: function(e) {
        // don't move text fields with focus, because user expects that cursor will move
        var position,
            selector = this.get('parent.activeTool') === 'move' ? '.selected' : '.selected.page-object-move,.selected:not(.page-object-multicell):not(.page-object-field)',
            draggable = this.get('el').find(selector).not('.page-object-readonly'),
            container = this.get('el'),
            id = this.positionUpdateTimers[draggable.attr('data-page-object-id')],
            distance = 1; // Distance in pixels the draggable should be moved

        if (draggable.length) {
            position = draggable.position();

            // Reposition if one of the directional keys is pressed
            switch (e.keyCode) {
                case $.ui.keyCode.LEFT:
                    position.left -= distance;
                    break;
                case $.ui.keyCode.UP:
                    position.top -= distance;
                    break;
                case $.ui.keyCode.RIGHT:
                    position.left += distance;
                    break;
                case $.ui.keyCode.DOWN:
                    position.top += distance;
                    break;
                default:
                    return true;
            }

            // Keep draggable within container
            if (position.left >= 0 && position.top >= 0 &&
                position.left + draggable.width() <= container.width() &&
                position.top + draggable.height() <= container.height()) {
                draggable.css(position);

                if (this.positionUpdateTimers[id]) {
                    clearTimeout(this.positionUpdateTimers[id]);
                }

                this.positionUpdateTimers[id] = setTimeout(_.bind(function() {
                    this.savePageObjectPosition(draggable);

                    delete this.positionUpdateTimers[id];
                }, this), 500);
            }

            // Don't scroll page
            e.preventDefault();
        }
    },

    exitMoveObjectMode: function() {
        this.get('el').find('.page-object-move textarea,input').prop('disabled', false);
        this.get('el').find('.page-object-move').removeClass('page-object-move');
    }.observes('selectedObjectId'),

    notifyAboutSelectionChange: function() {
        if (this.get('selectedObjectId') !== -1) {
            var obj = this.getObject(this.get('selectedObjectId'));

            this.trigger('select', this, obj.get('type'), obj.get('style.fontFamily'));
        }
    }.observes('selectedObjectId'),

    setSelectedObjectStyle: function(property, value, toggleValue) {
        if (this.get('selectedObjectId') !== -1) {
            this.addChange(this.edits.setObjectStyle, this.get('selectedObjectId'), property, value, toggleValue);
        }
    },

    selectedObject: function() {
        return this.getObject(this.get('selectedObjectId'));
    }.property('selectedObjectId', 'page.updatedAt'),

    // this function is called after CSS was applied to the property panel
    updatePropertyPanel: function() {
        if (!App.get('isNotMobileDevice')) {
            return;
        }

        var panel = $('#document-obj-properties'),
            id = this.get('selectedObjectId'),
            selectedObject,
            activateButton = function(id, prop, value) {
                if (selectedObject.get(prop) === value) {
                    panel.find(id).addClass('active');
                } else {
                    panel.find(id).removeClass('active');
                }
            };

        if (id !== -1) {
            selectedObject = this.get('selectedObject');

            panel.css('overflow', 'hidden').show().animate({
                opacity: 1
            }, 250, function() {
                panel.css('overflow', 'visible');
            });

            panel.find('button').blur();

            panel.find('#dop-color').css({
                color: selectedObject.get('style.color') || '#000000'
            });

            if (selectedObject.get('type') === 'field' || selectedObject.get('type') === 'multicell') {
                activateButton('#dop-bold', 'style.fontWeight', 'bold');
                activateButton('#dop-italic', 'style.fontStyle', 'italic');
                activateButton('#dop-underline', 'style.textDecoration', 'underline');
            } else if (selectedObject.get('type') === 'rect') {
                activateButton('#dop-fill', 'fill', true);
            }
        } else {
            panel.animate({
                opacity: 0
            }, 250, function() {
                panel.hide();
            });
        }
    },

    scheduleUpdatePropertyPanel: function() {
        if (!this.get('parent.form') && !this.get('parent.doc.signatureRequest')) {
            Ember.run.next(this, this.updatePropertyPanel); // run in the next cycle, to ensure that CSS changes are applied
        }
    }.observes('selectedObjectId', 'page.updatedAt'),

    selectPageObject: function(el, focus) {
        var selected = false;

        if (el.parents('#document-obj-properties').length) {
            return;
        }

        this.get('el').find('.selected').removeClass('selected');

        if (el.hasClass('page-object')) {
            el.addClass('selected');
            selected = true;
        } else if (el.parents('.page-object').length) {
            el = el.parents('.page-object');
            el.addClass('selected');
            selected = true;
        }

        if (selected && focus) {
            el.find('textarea,input').focus();
        }

        this.set('selectedObjectId', selected ? +el.attr('data-page-object-id') : -1);
    },

    selectInputOnFocus: function(e) {
        this.selectPageObject($(e.target), false);

        var object = this.getObject(this.get('selectedObjectId')),
            target = $(this.selectPrefix + '[data-page-object-id=' + object.id + ']');

        this.applyPageObjectPositionAndStyle(target, object, null, null, true);

        Ember.run.scheduleOnce('afterRender', function() {
            $(e.target).select();
        });
    },

    selectPageObjectOnClick: function(e) {
        this.selectPageObject($(e.target), true);
    },

    loadRequiredFormFields: function() {
        if (!this.get('requiredFieldsLoaded')) {
            var form = this.get('parent.form'),
                pageObjects = this.get('page.objects');

            _.each(pageObjects, function(obj) {
                if (obj.required) {
                    this.formRequiredFields[obj.id] = true;

                    if (_.isEmpty(obj.text)) {
                        this.setRequiredField(obj.id, true);
                    }
                }
            }, this);

            if (form) {
                var formPage;

                if (form && this.get('i') <= form.get('pages.length')) {
                    formPage = form.get('pages')[this.get('i') - 1];

                    _.each(formPage.objects, function(formObj) {
                        if (formObj && formObj.required) {
                            _.each(pageObjects, function(pageObj) {
                                if (pageObj.id == formObj.id) { // compare as str
                                    this.formRequiredFields[formObj.id] = true;

                                    if (_.isEmpty(formObj.text)) {
                                        this.setRequiredField(formObj.id, true);
                                    }

                                    return false;
                                }
                            }, this);
                        }
                    }, this);
                }

                this.get('page.objects').forEach(function(obj) {
                    // TODO: add 'required' field to new signature requests
                    if (obj.type === 'signature' && obj.request && !obj.edited && obj.required !== false) {
                        this.formRequiredFields[obj.id] = true;
                        this.setRequiredField(obj.id, true);
                    }
                }, this);
            } else if (this.get('parent.doc.signatureRequest')) {
                this.get('page.objects').forEach(function(obj) {
                    // TODO: add 'required' field to new signature requests
                    if (obj.type === 'signature' && obj.request && !obj.edited && obj.required !== false) {
                        this.formRequiredFields[obj.id] = true;
                        this.setRequiredField(obj.id, true);
                    }
                }, this);
            }

            this.set('requiredFieldsLoaded', true);
        }
    }.observes('page'),

    renderPage: function(force) {
        if (this.get('page') && this.get('visible') && (force || !this.get('rendered'))) {
            this.set('rendered', true);
            $(this.selectPrefix + '.page-object').remove();
            $(this.selectPrefix + ' img').remove();

            if (!App.get('isNotMobileDevice')) {
                this.get('el').append(sprintf('<img class="mobile-page-rendered" src="%s%s.png">', this.get('parent.doc.previewUrlRoot'), this.get('page.i') - 1));
            }

            if (this.get('page.objects.length') < 400) {
                this.loadRequiredFormFields();

                var objects = this.get('page.objects'),
                    readOnly = this.get('parent.doc.readOnly') && this.get('parent.doc.isTemplate');

                for (var i = 0; i < objects.length; i++) {
                    objects[i].readOnly = readOnly;
                    this.createPageObject(objects[i]);
                }
            } else {
                App.showNotification('Page #' + this.get('page.i') + ' is not scanned, or has too many fields. Please add fields manually', true);
                this.set('scanError', true);
            }

            Ember.run.cancel(this.attachPageObjectsListenersTimer);
            this.attachPageObjectsListenersTimer = Ember.run.later(this, this.attachPageObjectsListeners, 500); // this is to improve perceived speed

            this.setProperties({
                canvasPadding: 0,
                canvasWidth: 0,
                canvasHeight: 0,
                canvasMarginTop: 0,
                canvasMarginLeft: 0
            });

            this.onWindowResize();
        }
    }.observes('page'),

    getObjectsWithSameGroup: function(groupName) {
        var objectsWithSameGroup = [],
            pageObjects = this.get('page.objects');

        if (!groupName) {
            return objectsWithSameGroup;
        }

        if (pageObjects.length === 0) {
            return objectsWithSameGroup;
        }

        objectsWithSameGroup = pageObjects.filter(function(object) {
            return object.fieldGroup === groupName;
        });

        objectsWithSameGroup = objectsWithSameGroup.sort(function(firstField, secondField) {
            return firstField.y - secondField.y;
        });

        return objectsWithSameGroup;
    },

    firstRequiredAtGroup: function(fields) {
        var el = this.el;

        return fields.find(function(field) {
            return el.find('[data-page-object-id=' + field.id + ']').hasClass('page-object-required');
        });
    },

    getShowRequired: function(object) {
        var objectGroup = object.fieldGroup,
            objectsWithSameGroup,
            firstRequiredAtGroup;

        if (!objectGroup) {
            return this.el.find('[data-page-object-id=' + object.id + ']').hasClass('page-object-required');
        }

        objectsWithSameGroup = this.getObjectsWithSameGroup(objectGroup);
        firstRequiredAtGroup = this.firstRequiredAtGroup(objectsWithSameGroup);

        return firstRequiredAtGroup === object;
    },

    showFirstRequiredArrowAtGroup: function(object) {
        var _this = this,
            objectGroup = object.fieldGroup,
            firstRequiredField,
            requiredFieldsWithSameGroup = [],
            requiredFieldId,
            requiredObject;

        if (objectGroup && typeof objectGroup === 'string') {
            requiredFieldsWithSameGroup = this.getObjectsWithSameGroup(objectGroup);
            firstRequiredField = this.firstRequiredAtGroup(requiredFieldsWithSameGroup);

            requiredFieldsWithSameGroup.forEach(function(field) {
                var id = field.id;
                _this.el.find('[data-page-object-required-id="' + id + '"]').hide();
            });

            if (firstRequiredField) {
                requiredFieldId = firstRequiredField.id;
                requiredObject = this.getObject(requiredFieldId);
                this.setRequiredIndicatorPosition(requiredObject).show();
            }

            return;
        }

        requiredFieldId = object.id;
        requiredObject = this.el.find('[data-page-object-id=' + requiredFieldId + ']');

        if (requiredObject.hasClass('page-object-required')) {
            this.setRequiredIndicatorPosition(object).show();
            return;
        }

        this.setRequiredIndicatorPosition(object).hide();
    },

    createPageObject: function(object) {
        var cls = '',
            innerHtml = '',
            style = '',
            showRequired,
            required = this.formRequiredFields[object.id];

        if (object.type === 'checkbox') {
            cls = 'fa ' + (object.check ? 'fa-check-square-o' : 'fa-square-o');

            if (required && !object.check) {
                cls += ' page-object-required';
            }
        }

        if (object.type === 'signature') {
            innerHtml = '<img src="' + object.img + '" width="100%" height="100%" unselectable="on" draggable="false" />';

            if (object.request) {
                cls += ' page-object-signature-request';
            }

            if (required) {
                cls += ' page-object-required';
            }
        }

        if (object.type === 'multicell') {
            innerHtml = sprintf('<input type="text" class="page-object-field-input" %s %s></input>',
                object.text ? sprintf('value="%s"', _.escape(object.text)) : '', object.numCells ? sprintf('maxlength="%s"', object.numCells) : '');

            if (required && !object.text) {
                cls += ' page-object-required';
            }
        } else if (object.type === 'field') {
            innerHtml = sprintf('<textarea class="page-object-field-input" %s rows="%s">%s</textarea>',
                object.numCells ? sprintf('maxlength="%s"', object.numCells) : '', this.getRowsNumber(object.text), object.text ? _.escape(object.text) : '');

            if (required && !object.text) {
                cls += ' page-object-required';
            }
        }

        if (!this.get('parent.form') && !this.get('parent.doc.signatureRequest')) {
            if (object.readOnly) {
                cls += ' page-object-readonly';
            } else {
                if (App.get('isNotMobileDevice')) {
                    innerHtml += '<div class="po-inline-handle"></div><span class="po-tool-move" title="Drag&nbsp;to&nbsp;Move. Click&nbsp;to&nbsp;switch&nbsp;to&nbsp;Move&nbsp;mode." data-placement="right"></span><span class="po-tool-del" title="Remove" data-placement="right"></span>';
                }
            }
        }

        this.get('el').append(sprintf('<div class="page-object page-object-%s %s" data-page-object-id=%d style="%s">%s</div>', object.type, cls, object.id, style, innerHtml));

        if (this.get('parent.form') || this.get('parent.doc.signatureRequest')) {
            showRequired = this.getShowRequired(object);
            this.get('el').append(sprintf('<div class="page-object-required-indicator" data-page-object-required-id=%d style="%s"><i class="fa fa-hand-o-right"></i></div>', object.id, showRequired ? '' : 'display:none'));
        }
    },

    attachPageObjectsListeners: function() {
        $(this.selectPrefix + '.page-object-field textarea').autoGrowInput({
            minWidth: 20,
            comfortZone: 20
        }).on('autoGrow', _.bind(this.onAutoGrow, this));

        if (!this.get('parent.form') && !this.get('parent.doc.signatureRequest') && App.get('isNotMobileDevice')) {
            this.get('el').find('.page-object-field,.page-object-multicell,.page-object-rect').not('.page-object-readonly').draggable({
                containment: 'parent',
                stop: _.bind(this.pageObjectPositionChangedByPlugin, this),
                handle: '.po-tool-move,.po-inline-handle'
            });

            $(this.selectPrefix + '.page-object-signature').not('.page-object-readonly').draggable({
                containment: 'parent',
                stop: _.bind(this.pageObjectPositionChangedByPlugin, this)
            });

            this.get('el').find('.page-object-field,.page-object-multicell,.page-object-rect').not('.page-object-readonly').resizable({
                handles: 'e, w',
                stop: _.bind(this.pageObjectPositionChangedByPlugin, this)
            });

            $(this.selectPrefix + '.page-object-checkbox').not('.page-object-readonly').resizable({
                handles: 'n, e, s, w, se',
                aspectRatio: 1,
                stop: _.bind(this.pageObjectPositionChangedByPlugin, this)
            });

            var objects = this.get('page.objects');

            if (objects) {
                for (var i = 0; i < objects.length; i++) {
                    if (objects[i].type === 'signature') {
                        $(this.selectPrefix + '[data-page-object-id="' + objects[i].id + '"]').not('.page-object-readonly').resizable({
                            handles: 'n, e, s, w, se, sw, ne, nw',
                            aspectRatio: objects[i].imgW / objects[i].imgH,
                            stop: _.bind(this.pageObjectPositionChangedByPlugin, this)
                        });
                    }
                }
            }
        }

        this.el.find('.page-object [title]').tooltip();
    },

    onAutoGrow: function(e, args) {
        var parent = $(e.target).parent(),
            id = +parent.attr('data-page-object-id'),
            border = 2 * +parent.css('padding-left').replace('px', '') + 2 * +parent.css('border-left-width').replace('px', ''),
            parentWidth = Math.round(parent.width());

        if ((parentWidth !== args.width && parentWidth === args.oldWidth) || parentWidth < args.width) {
            parent.css({
                width: args.width + Math.round(border)
            });

            this.savePageObjectPosition(parent);
        } else {
            // input shoule take whole width to be clickable on iOS
            $(e.target).css({
                width: parentWidth - Math.round(border)
            });
        }
    },

    onAutoRowsGrow: function(el) {
        var parent = el.parent(),
            id = +parent.attr('data-page-object-id'),
            border = 2 * +parent.css('padding-top').replace('px', '') + 2 * +parent.css('border-top-width').replace('px', ''),
            parentHeight = Math.round(parent.height() + border),
            newHeight = Math.round(el.height() + border),
            HEIGHT_RESIZE_TOLERANCE = 2; // pixels

        if (parentHeight !== newHeight && Math.abs(parentHeight - newHeight) > HEIGHT_RESIZE_TOLERANCE) {
            parent.css({
                height: newHeight
            });

            this.savePageObjectPosition(parent);
        }
    },

    pageObjectPositionChangedByPlugin: function(e, ui) {
        this.savePageObjectPosition(ui.helper);
        this.set('resizing', true); // this is to prevent click handle

        Ember.run.later(this, function() {
            this.set('resizing', false);
        }, 50);
    },

    savePageObjectPosition: function(el) {
        if (!this.get('documentEditingEnabled')) {
            return;
        }

        var OBJECT_POS_FACTOR = this.get('parent.OBJECT_POS_FACTOR'),
            id = +el.attr('data-page-object-id');

        this.updatePageObjectPosition(id,
            Math.floor(((el.position().left - this.get('canvasPadding')) / this.get('canvasWidth')) * OBJECT_POS_FACTOR),
            Math.floor(((el.position().top - this.get('canvasPadding')) / this.get('canvasHeight')) * OBJECT_POS_FACTOR),
            Math.floor((el.outerHeight() / this.get('canvasHeight')) * OBJECT_POS_FACTOR),
            Math.floor((el.outerWidth() / this.get('canvasWidth')) * OBJECT_POS_FACTOR)
        );
    },

    // this should be called only after page objects are rendered
    onWindowResize: function() {
        var canvas = this.get('el');

        if (canvas.width() !== this.get('canvasWidth')) {
            canvas.height(canvas.width() * this.get('page.h') / this.get('page.w'));

            this.setProperties({
                canvasWidth: canvas.width(),
                canvasHeight: canvas.height(),
                canvasPadding: (canvas.outerWidth() - canvas.width()) / 2,
                canvasMarginTop: parseInt(canvas.css('marginTop').replace('px', ''), 10),
                canvasMarginLeft: parseInt(canvas.css('marginLeft').replace('px', ''), 10)
            });

            this.applyPageObjectsPositionAndStyle();
        }
    },

    applyPageObjectsPositionAndStyle: function() {
        if (this.get('scanError')) {
            return;
        }

        var objects = this.get('page.objects'),
            OBJECT_POS_FACTOR = this.get('parent.OBJECT_POS_FACTOR'),
            sortedByPos = _.sortBy(objects, function(obj) {
                // use 100 rows for controls
                var inaccuracy = Math.round(obj.h / 2);
                return Math.round(100 * (obj.y - inaccuracy + obj.h) / OBJECT_POS_FACTOR) * 100 + Math.round(100 * obj.x / OBJECT_POS_FACTOR);
                //return Math.round(100 * (obj.y + obj.h) / OBJECT_POS_FACTOR ) * 100 + Math.round(100 * obj.x / OBJECT_POS_FACTOR);
            }),
            letterSpacingCache = {},
            pageEl = this.get('el');
        for (var i = 0; i < sortedByPos.length; i++) {
            // use order to set tabindex
            this.applyPageObjectPositionAndStyle(pageEl.find('div[data-page-object-id="' + sortedByPos[i].id + '"]'), sortedByPos[i], i + 1, letterSpacingCache);
        }
    },

    applyPageObjectPositionAndStyle: function(el, object, tabIndex, letterSpacingCache, forceMulticellLetterSpacing) {
        if (!el.length) {
            return;
        }

        var OBJECT_POS_FACTOR = this.get('parent.OBJECT_POS_FACTOR'),
            fontSize = (object.fontSize || object.h) * this.get('canvasHeight') / OBJECT_POS_FACTOR,
            css = this.getPageObjectStyle(object),
            input;

        css.left = object.x * this.get('canvasWidth') / OBJECT_POS_FACTOR + this.get('canvasPadding');
        css.top = object.y * this.get('canvasHeight') / OBJECT_POS_FACTOR + this.get('canvasPadding');
        css.width = object.w * this.get('canvasWidth') / OBJECT_POS_FACTOR;
        css.height = object.h * this.get('canvasHeight') / OBJECT_POS_FACTOR;

        if (object.type === 'rect') {
            css.backgroundColor = object.fill ? css.borderColor : 'transparent';
            css.boxShadow = css.borderColor === '#ffffff' ? 'gray 0px 0px 5px' : '';
        }

        if (object.type === 'checkbox' && _.isUndefined(object.check)) {
            el.addClass('checkbox-not-touched');
        } else {
            css.color = css.color || '';
        }

        if (object.type === 'field' || object.type === 'multicell' || object.type === 'checkbox') {
            css.fontSize = fontSize;
        }

        if (object.type === 'field' || object.type === 'multicell') {
            css.paddingLeft = fontSize / 10;
            css.paddingRight = fontSize / 10;
        }

        el.css(css);

        if ((object.w * this.get('canvasWidth') / OBJECT_POS_FACTOR < this.RESIZE_HANDLER_SIZE_THRESHOLD) ||
            object.h * this.get('canvasHeight') / OBJECT_POS_FACTOR < this.RESIZE_HANDLER_SIZE_THRESHOLD) {
            el.addClass('no-resizer');
        } else {
            el.removeClass('no-resizer');
        }

        if (object.type === 'field' || object.type === 'multicell') {
            input = el.find('textarea,input');

            if (tabIndex) {
                input.attr('tabindex', this.get('i') * 1000 + tabIndex);
            }

            if (object.type === 'field') {
                input.trigger('font.change', fontSize); // for autoGrowInput plugin
                this.onAutoRowsGrow(input);
            }

            if (object.type === 'multicell') {
                input.css({
                    width: css.width + 10
                });

                if (forceMulticellLetterSpacing || (_.isString(object.text) && object.text.length)) {
                    // this is expensive operation on mobile, so avoid it if possible
                    this.setMulticellLetterSpacing(el, object, OBJECT_POS_FACTOR, fontSize, letterSpacingCache);
                }
            }
        }

        if (object.type === 'signature') {
            el.find('img').attr('src', object.img);
        }

        if (this.formRequiredFields[object.id]) {
            this.setRequiredIndicatorPosition(object);
        }
    },

    setRequiredIndicatorPosition: function(object) {
        var OBJECT_POS_FACTOR = this.get('parent.OBJECT_POS_FACTOR'),
            top = object.y * this.get('canvasHeight') / OBJECT_POS_FACTOR + this.get('canvasPadding'),
            height = object.h * this.get('canvasHeight') / OBJECT_POS_FACTOR;

        return $(this.selectPrefix + ' [data-page-object-required-id="' + object.id + '"]').css({
            top: top + (height - 30) / 2
        });
    },

    setMulticellLetterSpacing: function(el, object, OBJECT_POS_FACTOR, fontSize, letterSpacingCache) {
        var str,
            testDiv,
            targetWidth = object.w * this.get('canvasWidth') / OBJECT_POS_FACTOR,
            key = Math.round(targetWidth) + '-' + object.numCells + '-' + Math.round(fontSize * 100),
            letterSpacing = letterSpacingCache ? letterSpacingCache[key] : 0,
            binarySearch = function(testDiv, targetWidth, min, max) {
                if (Math.round(min * 10) === Math.round(max * 10)) {
                    return min;
                }

                var letterSpacing = (min + (max - min) / 2),
                    width;

                testDiv.css('letter-spacing', letterSpacing + 'px');
                width = Math.round(testDiv.width());

                if (width === targetWidth) {
                    return letterSpacing;
                }

                return binarySearch(testDiv, targetWidth, width > targetWidth ? min : letterSpacing, width > targetWidth ? letterSpacing : max);
            };

        if (!letterSpacing) {
            str = new Array(object.numCells + 1).join('P');
            testDiv = $("#div-test-width");
            testDiv.css('font-size', fontSize * this.get('parent.CSS_FONT_SIZE_RATIO'));
            testDiv.html(str);

            letterSpacing = binarySearch(testDiv, Math.round(targetWidth), 0, targetWidth / object.numCells);

            if (letterSpacingCache) {
                letterSpacingCache[key] = letterSpacing;
            }
        }

        el.children('input').css('letter-spacing', letterSpacing + 'px');
        el.css({
            paddingLeft: (letterSpacing / 2) + 'px',
            paddingRight: (letterSpacing / 2) + 'px'
        });
    },

    getPageObjectStyle: function(obj) {
        var css = obj.get('style');

        if (!css) {
            return {};
        }

        css = css.getProperties(Ember.keys(css)); // clone to prevent setting top/left/... properties

        if (obj.get('type') === 'rect' && css.hasOwnProperty('color')) {
            css.borderColor = css.color;
        }

        return css;
    },

    onCheckboxClick: function(event) {
        if (this.get('parent.activeTool') === 'move' || !this.get('documentEditingEnabled')) {
            return;
        }

        var control = $(event.target),
            id,
            object;

        if (control.hasClass('po-tool-move')) {
            return;
        }

        if (!control.hasClass('page-object')) {
            control = control.parents('.page-object');
        }

        id = +control.attr('data-page-object-id');
        object = this.getObject(id);
        object.check = !object.check;
        control.removeClass(!object.check ? 'fa-check-square-o' : 'fa-square-o');
        control.removeClass('checkbox-not-touched');
        control.addClass(object.check ? 'fa-check-square-o' : 'fa-square-o');

        this.updatePageObject(id, {
            check: !!object.check
        });

        if (this.formRequiredFields.hasOwnProperty(id)) {
            this.setRequiredField(id, !object.check);

            if (object.check) {
                control.removeClass('page-object-required');
            } else {
                control.addClass('page-object-required');
            }

            this.showFirstRequiredArrowAtGroup(object);
        }

        if (object.group && object.check) {
            this.get('page.objects').forEach(function(obj) {
                if (obj.type === 'checkbox' && obj.group === object.group && obj.id !== object.id) {
                    obj.check = false;
                    this.el.find('[data-page-object-id="' + obj.id + '"]').removeClass('fa-check-square-o').addClass('fa-square-o');

                    this.updatePageObject(obj.id, {
                        check: false
                    });
                }
            }, this);
        }
    },

    onFormSignatureClick: function(e) {
        var el = $(e.target);

        if (!el.hasClass('page-object-signature')) {
            el = el.parents('.page-object-signature');
        }

        var obj = this.getObject(+el.attr('data-page-object-id'));

        if (obj.request === 'signature' || obj.request === 'initials') {
            this.get('parent').trigger(obj.request === 'signature' ? 'show-signature-modal' : 'show-initials-modal', true);
        }
    },

    onTextChange: function(e) {
        if (!this.get('documentEditingEnabled')) {
            return;
        }

        var input = $(e.target),
            el = input.parent(),
            text = input.val(),
            id = +el.attr('data-page-object-id'),
            object = this.getObject(id);

        this.updatePageObject(id, {
            text: text.replace(/ +$/, '') // right trim
        });

        if (this.formRequiredFields.hasOwnProperty(id)) {
            this.setRequiredField(id, !text.length);

            if (text.length) {
                el.removeClass('page-object-required');
            } else {
                el.addClass('page-object-required');
            }

            this.showFirstRequiredArrowAtGroup(object);
        }
    },

    updatePageObject: function(id, data) {
        if (this.get('page')) {
            this.addChange(this.edits.updateObject, id, data);
        }
    },

    updatePageObjectPosition: function(id, x, y, h, w) {
        var object = this.getObject(id);

        if (object) {
            var data = {
                x: x,
                y: y,
                h: h,
                w: w
            };

            if (object.type === 'field' || object.type === 'multicell') {
                data.fontSize = object.get('fontSize') || object.get('h');
            }

            this.addChange(this.edits.updateObject, object.id, data);
        }
    },

    getObject: function(id) {
        if (id !== -1 && this.get('page')) {
            return this.get('page.objects').findBy('id', id);
        }

        return null;
    },

    // saving
    addChange: function(func) {
        var args = [];

        for (var i = 1; i < arguments.length; i++) {
            args.push(arguments[i]);
        }

        this.pendingChanges.push({
            func: func,
            args: args
        });

        this.applyChanges();
    },

    applyChanges: function() {
        if (this.get('parent.isSaving')) {
            Ember.run.cancel(this.applyChangesTimer);

            if (this.pendingChanges.length) {
                this.applyChangesTimer = Ember.run.later(this, this.applyChanges, 100);
            }
        } else {
            var pendingChanges = this.pendingChanges; // copy array to resolve issue with changes that added during other changes
            this.pendingChanges = [];

            if (this.get('scanError')) {
                this.set('page.objects', []);
                this.set('scanError', false);
                App.showNotification('This change overrides errors on page #' + this.get('page.i'));
            }

            for (var i = 0; i < pendingChanges.length; i++) {
                pendingChanges[i].func.apply(this, pendingChanges[i].args);
            }

            this.trigger('change', this.get('page'));
        }
    },

    onObjectStyleUpdated: function(object) {
        var target = $(this.selectPrefix + '[data-page-object-id=' + object.id + ']');
        this.applyPageObjectPositionAndStyle(target, object);
    },

    getRequiredField: function(id) {
        return this.get('parent.requiredFields')['page' + this.get('i') + '_field' + id];
    },

    setRequiredField: function(id, value) {
        var json = this.get('parent.requiredFields'),
            key = 'page' + this.get('i') + '_field' + id;

        if (value) {
            json[key] = true;
        } else {
            delete json[key];
        }

        this.formRequiredFields[id] = value;
        this.set('parent.requiredFieldsCount', _.keys(json).length);
    }
});
