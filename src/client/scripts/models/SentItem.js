App.SentItem = DS.Model.extend({
    doc: DS.attr('string'),
    name: DS.attr('string'),
    status: DS.attr('string'),
    statusDetails: DS.attr('string'),
    to: DS.attr('string'),
    type: DS.attr('string'),
    updatedAt: DS.attr('date'),
    url: DS.attr('string'),
    isSigned: function() {
        return this.get('status') === 'signed';
    }.property('status'),
    isPending: function() {
        return this.get('status') === 'pending';
    }.property('status'),
    isFailed: function() {
        return this.get('status') === 'failed';
    }.property('status'),
    isEmail: function() {
        return this.get('type') === 'email';
    }.property('type'),
    isSignatureRequest: function() {
        return this.get('type') === 'signatureRequest';
    }.property('type'),
    isSendSignature: function() {
        return this.get('type') === 'sendSignature';
    }.property('type')
});
