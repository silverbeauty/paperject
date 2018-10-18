$(document).ready(function() {
    var innerWidth = window.innerWidth ||
        document.documentElement.clientWidth ||
        document.body.clientWidth;

    // Hover to open nav

    /*if(innerWidth >767){
	 		$('ul.nav li.dropdown').hover(function() {
	 			$('.dropdown-menu',this).slideDown();
	 		}, function() {
	 			$('.dropdown-menu',this).fadeOut('fast');
	 		});
		}*/

    // Popover
    /*$('body').popover({
 			selector: '[rel=popover]',
 			trigger: 'hover',
 			placement:'top'
 		});*/

    //
    $('.navbar-default').on('affix.bs.affix', function() {
        $(this).addClass('animated fadeIn');
    });

    $('.navbar-default').on('affixed-top.bs.affix', function() {
        $(this).removeClass('animated fadeIn');
    });

    var avatar = $('meta[name="user-avatar"]').attr('content');

    if (avatar) {
        $('#avatar-holder').css('background-image', 'url(//secure.gravatar.com/avatar/' + avatar + '?d=https://' + window.location.host + '/images/user-profile.png)');
    }

    if ((/ref=producthunt/i).exec(window.location.href) && $('#producthunt-modal').length) {
        $('#producthunt-modal').modal('show');
        window.clientStorage.storeValue('producthunt', true);
    }
});
