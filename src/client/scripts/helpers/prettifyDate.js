/*global Handlebars, moment*/
Ember.Handlebars.helper('prettifyDate', function(date, showTime, showSeconds) {
    if (showTime === true && showSeconds === true) {
        return date ? moment(new Date(date)).format('MM/DD/YYYY h:mm:ss a') : '';
    }

    if (showTime === true) {
        return date ? moment(new Date(date)).format('MM/DD/YYYY h:mm a') : '';
    }

    return date ? moment(new Date(date)).format('MM/DD/YYYY') : '';
});
