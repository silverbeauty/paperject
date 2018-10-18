/*global module,moduleFor,test,visit,equal,currentRouteName,andThen,currentURL*/

module('Document routing', {
    setup: function() {
        Ember.run(App, App.advanceReadiness);
    },
    teardown: function() {
        App.reset();
    }
});

var setupLoginAndDoc = function() {
    // use direct injection, because modelFor isolates code which won't work in this test
    App.__container__.lookup('route:application').onLoginSuccess({
        _id: 1
    });

    // this is to allow transition to the route
    App.__container__.lookup('store:main').pushPayload('document', {
        documents: [{
            _id: '434ce0f1'
        }]
    });

    App.__container__.lookup('controller:doc').set('pdfUrl', '/client/Developers Developers Developers Developers.pdf');
};

test('redirect to login', function() {
    visit('/');

    andThen(function() {
        equal(currentRouteName(), 'login', currentRouteName());
    });
});

test('no redirect to login', function() {
    Ember.run(function() {
        setupLoginAndDoc();
        visit('/434ce0f1');

        andThen(function() {
            equal(currentRouteName(), 'doc.edit', currentRouteName());
        });
    });
});

test('redirect to first doc page', function() {
    Ember.run(function() {
        setupLoginAndDoc();
        visit('/434ce0f1');

        andThen(function() {
            equal(currentURL(), '/434ce0f1/1', currentURL());
        });
    });
});

test('redirect to first doc page if route is not recognized', function() {
    Ember.run(function() {
        setupLoginAndDoc();
        visit('/434ce0f1/unknown_route/123');

        andThen(function() {
            equal(currentURL(), '/434ce0f1/1', currentURL());
        });

        visit('/434ce0f1/pages/1/unknown_route/123');

        andThen(function() {
            equal(currentURL(), '/434ce0f1/1', currentURL());
        });
    });
});

test('redirect to first doc page if page is not an integer', function() {
    Ember.run(function() {
        setupLoginAndDoc();
        visit('/434ce0f1/abc');

        andThen(function() {
            equal(currentURL(), '/434ce0f1/1', currentURL());
        });
    });
});

test('redirect to first pages page if start is not an integer', function() {
    Ember.run(function() {
        setupLoginAndDoc();
        visit('/434ce0f1/pages/abc');

        andThen(function() {
            equal(currentURL(), '/434ce0f1/pages/1', currentURL());
        });
    });
});
