App.Signature = DS.Model.extend({
    name: DS.attr('string'),
    img: DS.attr('string'), // PNG format only
    h: DS.attr('number'),
    w: DS.attr('number'),
    type: DS.attr('string'), // initials | signature
    createdAt: DS.attr('date'),
    updatedAt: DS.attr('date')
});
