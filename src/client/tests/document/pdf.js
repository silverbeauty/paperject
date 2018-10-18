/*global module,moduleFor,test,visit,equal,currentRouteName,andThen,currentURL*/

module('PDF', {
    setup: function() {
        Ember.run(App, App.advanceReadiness);

        Ember.run(function() {
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
        });
    },
    teardown: function() {
        App.reset();
    }
});

test('thumbnails rendering', function() {
    return new Ember.RSVP.Promise(function(resolve, reject) {
        Ember.run(function() {
            visit('/434ce0f1');

            var controller = App.__container__.lookup('controller:doc');

            controller.addObserver('loadedThumbnails', function(val) {
                var expectThumbnails = 132,
                    MAX_PREVIEWS = 12,
                    renderedThumbnails = 0,
                    thumbnails = controller.get('thumbnails');

                equal(controller.get('totalPages'), expectThumbnails, 'Expect ' + expectThumbnails + ' pages in the document');
                equal(controller.get('thumbnails.length'), expectThumbnails, 'Expect ' + expectThumbnails + ' thumbnails');
                equal(controller.get('MAX_PREVIEWS'), MAX_PREVIEWS, 'Expect MAX_PREVIEWS to be ' + MAX_PREVIEWS);

                for (var i = 0; i < expectThumbnails; i++) {
                    if (thumbnails[i].img) {
                        renderedThumbnails++;
                    }
                }

                equal(renderedThumbnails, MAX_PREVIEWS, 'Expect ' + MAX_PREVIEWS + ' thumbnails to be rendered');
                resolve();
            });
        });
    });
});

test('thumbnails rendering for second page', function() {
    return new Ember.RSVP.Promise(function(resolve, reject) {
        Ember.run(function() {
            visit('/434ce0f1/pages/2');

            var controller = App.__container__.lookup('controller:doc');

            controller.addObserver('loadedThumbnails', function() {
                Ember.run(function() {
                    var MAX_PREVIEWS = 12,
                        renderedThumbnails = 0,
                        thumbnails = controller.get('thumbnails'),
                        i;

                    for (i = MAX_PREVIEWS; i < MAX_PREVIEWS * 2; i++) {
                        if (thumbnails[i].img) {
                            renderedThumbnails++;
                        }
                    }

                    equal(renderedThumbnails, MAX_PREVIEWS, 'Expect thumbnails to be rendered in range ' + MAX_PREVIEWS + '..' + MAX_PREVIEWS * 2);

                    renderedThumbnails = 0;

                    for (i = 0; i < thumbnails.length; i++) {
                        if (thumbnails[i].img) {
                            renderedThumbnails++;
                        }
                    }

                    equal(renderedThumbnails, MAX_PREVIEWS, 'Expect total ' + MAX_PREVIEWS + ' thumbnails to be rendered');
                    resolve();
                });
            });
        });
    });
});
