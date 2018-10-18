/*global jQuery*/
// see http://stackoverflow.com/questions/931207/is-there-a-jquery-autogrow-plugin-for-text-fields
(function($) {
    'use strict';
    $.fn.autoGrowInput = function(o) {
        o = $.extend({
            maxWidth: 1000,
            minWidth: 0,
            comfortZone: 70
        }, o);

        this.filter('textarea').each(function() {
            var minWidth = o.minWidth || $(this).width(),
                val = '',
                input = $(this),
                lastFontSize = 0,
                testSubject = $('<tester/>').css({
                    position: 'absolute',
                    top: -9999,
                    left: -9999,
                    width: 'auto',
                    fontSize: '65%',
                    // input.css('fontSize'),
                    // fontFamily: input.css('fontFamily'),
                    // fontWeight: input.css('fontWeight'),
                    // letterSpacing: input.css('letterSpacing'),
                    whiteSpace: 'nowrap'
                }),
                check = function() {
                    if (val === (val = input.val())) {
                        return;
                    }

                    // Enter new content into testSubject
                    var escaped = val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r\n/g, '\n').replace(/\n/g, '<br/>').replace(/\s/g, ' ').replace(/ /g, '&nbsp;');
                    testSubject.html(escaped);

                    // Calculate new width + whether to change
                    var testerWidth = testSubject.width(),
                        newWidth = (testerWidth + o.comfortZone) >= minWidth ? testerWidth + o.comfortZone : minWidth,
                        currentWidth = input.width(),
                        isValidWidthChange = (newWidth < currentWidth && newWidth >= minWidth) || (newWidth > minWidth && newWidth < o.maxWidth);

                    if (!isValidWidthChange && newWidth > minWidth && newWidth > o.maxWidth) {
                        newWidth = o.maxWidth;
                        isValidWidthChange = true;
                    }

                    // Animate width
                    if (isValidWidthChange) {
                        input.width(newWidth);
                        input.trigger('autoGrow', {
                            width: newWidth,
                            oldWidth: currentWidth
                        });
                    }
                };

            testSubject.insertAfter(input);

            $(this).bind('keyup keydown blur update object.change', check);

            $(this).bind('font.change', function(e, fontSize) {
                if (lastFontSize !== fontSize) {
                    lastFontSize = fontSize;
                    val = null;
                    check();
                }
            });

            // Auto-size when page first loads
            check();
        });

        return this;
    };

})(jQuery);
