App.Form = DS.Model.extend({
    doc: DS.belongsTo('document'),
    redirectUrl: DS.attr('string'),
    email: DS.attr('string'),
    homepage: DS.attr('string'),
    homepageTitle: DS.attr('string'),
    validation: DS.attr('string'),
    pages: DS.attr(), // array
    createdAt: DS.attr('date'),
    updatedAt: DS.attr('date')
});
