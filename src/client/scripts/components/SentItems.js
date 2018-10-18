'use strict';

App.SentItemsComponent = Ember.Component.extend({
    classNames: 'sent-items col-sm-9',
    items: null,

    sorters: {
        name: null,
        date: null,
        status: null
    },

    actions: {
        changeSortDirection: function(name) {
            var sorters = {
                name: null,
                date: null,
                status: null
            };

            if (!this.get('sorters.' + name)) {
                sorters[name] = {
                    asc: true
                };
            } else if (this.get('sorters.' + name + '.asc')) {
                sorters[name] = {
                    desc: true
                };
            }

            this.set('sorters', sorters);
        },

        clearAll: function() {
            var el = $('#' + this.elementId + ' .js-clear-sent');

            el.popover({
                html: true,
                content: '<div style="width:200px">' +
                    '<div>Are you sure you want to clear the list of sent items? It will not cancel pending items.</div>' +
                    '<div style="padding-top:10px"><button type="button" class="btn btn-danger btn-block js-clear-sent-confirm">Clear</button></div>' +
                    '</div>',
                trigger: 'manual',
                placement: 'left'
            });

            el.popover('show');
        }
    },

    click: function(e) {
        var el = $(e.target);

        if (el.hasClass('js-clear-sent-confirm')) {
            this.get('items').forEach(function(rec) {
                rec.destroyRecord();
            });

            $('.popover').popover('hide');
            e.preventDefault();
            e.stopPropagation();
            return;
        }
    },

    sortedItems: function() {
        var sorter = 'updatedAt',
            desc = true,
            result;

        if (this.get('sorters.name')) {
            sorter = 'name';
            desc = !this.get('sorters.name.asc');
        } else if (this.get('sorters.status')) {
            sorter = 'status';
            desc = !this.get('sorters.status.asc');
        } else if (this.get('sorters.date')) {
            sorter = 'updatedAt';
            desc = !this.get('sorters.date.asc');
        }
        result = _(this.get('items').sortBy(sorter));

        if (desc) {
            result = result.reverse();
        }

        return result.value();
    }.property('items', 'items.length', 'sorters')
});
