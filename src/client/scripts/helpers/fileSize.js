/*global Handlebars*/
Ember.Handlebars.helper('fileSize', function(bytes) {
    var thresh = 1024,
        units = ['kB','MB','GB','TB','PB','EB','ZB','YB'],
        u = -1,
        truncateDecimals = function (number, digits) {
            var multiplier = Math.pow(10, digits),
                adjustedNum = number * multiplier,
                truncatedNum = Math[adjustedNum < 0 ? 'ceil' : 'floor'](adjustedNum);

            return truncatedNum / multiplier;
        };

    if(bytes < thresh) return bytes + ' B';

    do {
        bytes /= thresh;
        ++u;
    } while(bytes >= thresh);

    // do not use .toFixed() since it rounds a number and user can be confused when he see "1024 MB of 1 GB"
    // instead of "1023.9 MB of 1 GB" when size is 1023.998
    return truncateDecimals(bytes || 0, 1) + ' ' + units[u];
});
