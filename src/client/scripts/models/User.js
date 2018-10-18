App.User = DS.Model.extend({
    firstName: DS.attr('string'),
    lastName: DS.attr('string'),
    email: DS.attr('string'),
    password: DS.attr('string'),
    subscription: DS.attr(),
    createdAt: DS.attr('date'),
    paidUntil: DS.attr('date'),
    metrics: DS.attr(),
    tips: DS.attr(),
    isAnonymous: DS.attr('boolean'),
    supportsForms: DS.attr('boolean'),
    supportsUpload: DS.attr('boolean'),
    supportsManageFolders: DS.attr('boolean'),
    isNonRegisteredUser: DS.attr('boolean', {
        defaultValue: false
    }),
    displayName: function() {
        var firstName = this.get('firstName'),
            lastName = this.get('lastName');

        if (_.isString(firstName) && firstName.length && _.isString(lastName) && lastName.length) {
            return $.trim(firstName + ' ' + lastName);
        }

        return '';
    }.property('firstName', 'lastName'),
    isOAuthUser: DS.attr('boolean'),
    isPassworSet: DS.attr('boolean'),
    isEmailConfirmed: DS.attr('boolean'),
    inviteId: DS.attr('string')
        // ,
        // documents: DS.hasMany('document', {
        //     async: true
        // })
});
