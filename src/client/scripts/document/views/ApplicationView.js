App.ApplicationView = Ember.View.extend({
    classNames: ['app-container'],

    didInsertElement: function() {
        $('.app-header .nav a').on('click', function() {
            if ($('.navbar-toggle').is(":visible")) {
                $('.navbar-toggle').click();
            }
        });

        if (this.get('controller.model.profile.supportsUpload')) {
            this.get('controller.fileUploadService').createDropZone({
                target: $('body'),
                isFullscreen: true,
                success: function(data) {
                    App.showNotification(data.detectorMessage, true);
                },
                error: function(errorMessage) {
                    App.showError(errorMessage);
                }
            });
        }

        $('#app-loading').remove();
        $('#app-loading-nav').remove();

        // https://github.com/twbs/bootstrap/issues/17324
        // bootstrap modal enhancement with input field
        if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
            $('body').on('show.bs.modal', '.modal', function(e) {
                // fix the problem of ios modal form with input field
                // Position modal absolute and bump it down to the scrollPosition
                var heightModal = Math.max($('body').height(), $(window).height(), $(document).height()) + 1;
                $(this).css({
                    position: 'absolute',
                    paddingTop: $(window).scrollTop() + 'px',
                    height: heightModal + 'px'
                });
                // Position backdrop absolute and make it span the entire page
                //
                // Also dirty, but we need to tap into the backdrop after Boostrap
                // positions it but before transitions finish.
                //
                setTimeout(function() {
                    $('.modal-backdrop').css({
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: heightModal + 'px'
                    });
                }, 500);
            });
        }
    }
});
