App.SignatureDropdownItemView = Ember.View.extend({
    tagName: '',
    templateName: 'views/signature-dropdown-item',

    actions: {
        removeItem: function(signature) {
            var itemEl = $(sprintf('.signatures-dropdown li[data-signature-id=%s]', signature.get('id')));
            itemEl.popover('destroy');
            var confirm = itemEl.popover({
                html: true,
                content: '<div>Delete this signature?</div>' +
                '<div style="padding-top:10px"><button type="button" class="btn btn-danger btn-block delete-signature-confirm">Delete</button></div>',
                trigger: 'manual',
                placement: 'left'
            });

            confirm.popover('show');

            $('.delete-signature-confirm').click(_.bind(function(e) {
                e.stopPropagation();
                this.get('controller.signaturesNotFiltered').findBy('id', signature.get('id')).destroyRecord();
            }, this));

            var hidePopover = function(e) {
                if ($(e.target).closest('.popover').length === 0) {
                    confirm.popover('destroy');
                    $(document).off('click', hidePopover);
                }
            };

            $(document).on('click', hidePopover);
        }
    }
});
