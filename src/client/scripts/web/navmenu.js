$(function() {
    var scrollToSectionAnimating = false,
        CONTAINER_SELECTOR = '.top-header-panel .navbar-nav, .footer-bottom',
        scrollToSection = function(selector) {
            if (!(/(#[a-z0-9_-]+$)/i).test(selector)) {
                // FB redirects to #_=_ hash
                return;
            }

            var section = $(selector);

            if (!section.length || scrollToSectionAnimating) {
                return;
            }

            scrollToSectionAnimating = true;

            var topPosition = section.position().top,
                navBarHeight = $('.top-header-panel > .navbar').height();

            $('body,html').animate({
                scrollTop: (topPosition - navBarHeight) + 'px'
            }, 900, function() {
                setActiveItemBySelector(selector);
                scrollToSectionAnimating = false;
            });
        },

        /**
         * Adds `active` class to the menu item
         * @param selector
         */
        setActiveItemBySelector = function(selector) {
            $(CONTAINER_SELECTOR).find('a[href*="' + selector + '"]').parent()
                .addClass('active')
                .siblings()
                .removeClass('active');
        },

        /**
         * Adds `active` class to the related menu item
         */
        setActiveItemByPosition = function() {
            var navBarHeight = $('.top-header-panel > .navbar').height(),
                bodyScrollTop = document.body.scrollTop + navBarHeight,
                menuItems = $(CONTAINER_SELECTOR).find('li > a'),
                found = false;

            menuItems.each(function(key, el) {
                var selector = '.js-' + el.getAttribute('href').replace(/.*#/, '');

                if (selector.indexOf('/') > -1) {
                    return;
                }

                var section = $(selector);

                if (section.length) {
                    var from,
                        to;

                    if (section.length == 1) {
                        from = section.position().top;
                        to = from + section.outerHeight(true);
                    } else {
                        from = Number.MAX_VALUE;
                        to = 0;

                        section.each(function(sectionKey, sectionEl) {
                            sectionEl = $(sectionEl);
                            from = Math.min(sectionEl.position().top, from);
                            to = Math.max(sectionEl.position().top + sectionEl.outerHeight(true), to);
                        });
                    }

                    if (bodyScrollTop >= from && bodyScrollTop <= to) {
                        setActiveItemBySelector('#' + el.getAttribute('href').replace(/.*#/, ''));
                        found = true;
                        return false; // break the iteration
                    }
                }
            });

            if (!found) {
                $(CONTAINER_SELECTOR).find('li').removeClass('active');
            }
        },
        initEvents = function() {
            // init scroll to menu
            var menuItems = $(CONTAINER_SELECTOR).find('li > a');

            menuItems.on('click.navmenu', function(e) {
                $('.top-header-panel .navbar-collapse').removeClass('in');
                var selector = '#' + e.currentTarget.getAttribute('href').replace(/.*#/, '');

                if (selector.indexOf('/') > -1) {
                    return;
                }

                var section = $(selector);
                if (section.length) {
                    e.preventDefault();
                    setActiveItemBySelector(selector);
                    scrollToSection(selector);
                }
            });

            $(window).on('scroll.navmenu', _.debounce(function(e) {
                setActiveItemByPosition();
            }, 150));
        },
        scrollOnLoad = function() {
            // if page is loaded and has hash then we need to scroll to the section
            var hash = location.hash;
            if (hash.length && hash.indexOf('#') > -1) {
                $(window).load(function() {
                    scrollToSection(hash);
                });
            }
        };

    initEvents();
    scrollOnLoad();
});
