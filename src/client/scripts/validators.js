'use strict';
/*global jQuery*/

jQuery.validator.addMethod('multiemail', function(value, element) {
    if (this.optional(element)) {
        return true;
    }

    var emails = value.split(','),
        valid = true;

    for (var i = 0, limit = emails.length; i < limit; i++) {
        value = emails[i].trim();
        valid = valid && jQuery.validator.methods.email.call(this, value, element);
    }

    return valid;
}, 'Invalid email format: please use a comma to separate multiple email addresses.');

jQuery.validator.addMethod('simplifiedPassword', function(value, element, regexp) {
    var re = new RegExp('^[a-zA-Z-_0-9 ]+$');
    return this.optional(element) || re.test(value);
}, 'Password may contain latin letters, spaces, numbers, "_" and "-" characters. Spaces will be trimmed from the beginning and end of the password.');

jQuery.validator.addMethod('simplifiedPhoneValidation', function(value, element) {
    value = value.replace(/\s+/g, '');
    return this.optional(element) || value.length > 5 && value.match(/^\+?[0-9\-\(\)]+$/);
}, 'Please specify a valid phone number');
