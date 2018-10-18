var lastAjax = [],
    sendErrorToServer = function() {
        var data = {
            cookieEnabled: navigator.cookieEnabled,
            language: navigator.language,
            userAgent: navigator.userAgent,
            browserTime: new Date(),
            location: location.href,
            viewport: $(window).width() + 'x' + $(window).height(),
            lastAjax: lastAjax
        };

        if (arguments.length === 1) {
            // the error event is handled by Ember.onerror
            data.errorObject = arguments[0];
            data.stack = arguments[0].stack;

            if (arguments[0] && arguments[0].pjRequestURL) {
                data.requestUrl = arguments[0].pjRequestURL;
            }
        } else if (arguments.length >= 3) {
            data.message = arguments[0];
            data.fileName = arguments[1];
            data.line = arguments[2];

            // modern browsers support 5 params for window.onerror
            if (arguments.length === 5) {
                data.column = arguments[3];

                if (arguments[4]) {
                    data.stack = arguments[4].stack;
                }
            }
        }

        $.ajax({
            url: '/api/v1.0/tracking',
            data: data,
            type: 'post',
            dataType: 'json'
        });
    };

$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        xhr.pjRequestURL = settings.type + ' ' + settings.url;

        lastAjax.push((new Date()).toJSON() + ' ' + settings.type + ' ' + settings.url + ' ' + ((settings.data || '') + '').substr(0, 200));

        if (lastAjax.length > 5) {
            lastAjax.splice(0, lastAjax.length - 5);
        }
    }
});

window.onerror = function(errorMsg, url, lineNumber, column, errorObj) {
    sendErrorToServer(errorMsg, url, lineNumber, column, errorObj);
};

if (typeof Ember !== 'undefined') {
    Ember.onerror = function(error) {
        Ember.Logger.error(error);
        sendErrorToServer(error);
    };
}
