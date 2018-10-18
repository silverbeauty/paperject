App.TreeNodeComponent = Ember.Component.extend({
    tagName: 'li',
    classNames: ['tree-node'],
    isExpanded: false,

    actions: {
        toggle: function() {
            this.loadData();
            this.toggleProperty('isExpanded');
        },

        didClick: function() {
            this.loadData();
            this.set('isExpanded', true);
            this.drive.set('selectedNode', this.get('node'));
        }
    },

    hasChildren: function() {
        return !this.get('node.dataLoaded') || this.get('node.children.length') !== 0;
    }.property('node.dataLoaded'),

    loadData: function() {
        if (!this.get('node.dataLoaded') && !this.get('node.dataLoading')) {
            this.drive.expand(this.get('node'));
        }
    }
});
