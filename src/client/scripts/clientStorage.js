window.clientStorage = {
    _storageMethod: 'none',

    _init: function() {
        // Check localStorage support, fall back to cookies if not
        if (this._localStorageEnabled()) {
            this._storageMethod = 'localstorage';
        } else if (this._cookiesEnabled()) {
            this._storageMethod = 'cookies';
        } else {
            this._storageMethod = 'none';
        }
    },

    supported: function() {
        return this._storageMethod === 'localstorage' || this._storageMethod === 'cookies';
    },

    storeValue: function(variable, value) {
        if (this._storageMethod == 'localstorage') {
            localStorage.setItem(variable, value);
        } else if (this._storageMethod == 'cookies') {
            this._createCookie(variable, value, 1000);
        }
    },

    readValue: function(variable) {
        var result;
        if (this._storageMethod == 'localstorage') {
            result = localStorage.getItem(variable);
        } else if (this._storageMethod == 'cookies') {
            result = this._readCookie(variable);
        }
        return result;
    },

    removeValue: function(variable, value) {
        if (this._storageMethod == 'localstorage') {
            localStorage.removeItem(variable);
        } else if (this._storageMethod == 'cookies') {
            this._eraseCookie(variable);
        }
    },

    _cookiesEnabled: function() {
        var val = 'testing';
        try {
            this._createCookie(val, 'Hello', 1);
            this._readCookie(val);
            this._eraseCookie(val);
            return true;
        } catch (e) {
            return false;
        }
    },

    _localStorageEnabled: function() {
        var val = 'testing';
        try {
            localStorage.setItem(val, val);
            localStorage.removeItem(val);
            return true;
        } catch (e) {
            return false;
        }
    },

    _createCookie: function(name, value, days) {
        var expires;
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = '; expires=' + date.toGMTString();
        } else expires = '';
        document.cookie = name + '=' + value + expires + '; path=/';
    },

    _readCookie: function(name) {
        var nameEQ = name + '=';
        var ca = document.cookie.split(';');

        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];

            while (c.charAt(0) === ' ') {
                c = c.substring(1, c.length);
            }

            if (c.indexOf(nameEQ) === 0) {
                return c.substring(nameEQ.length, c.length);
            }
        }
        return null;
    },

    _eraseCookie: function(name) {
        this._createCookie(name, '', -1);
    }
};

window.clientStorage._init();
