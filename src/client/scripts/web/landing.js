$(document).ready(function() {
    var userCountryCode = 'US';
    $.ajax({
        url:"https://api.wipmania.com/jsonp?callback=?",
        dataType:"jsonp"
    }).done(function(data) {
        userCountryCode = data.address.country_code;
    });

    // POST request to create anonymous user (Try Paperjet) to prevent using this feature by web crawlers
    $('#try-paperjet').click(function() {
        $.ajax({
            url: '/api/v1.0/connection',
            data: {
                action: 'register-anonymous'
            },
            type: 'post',
            dataType: 'json',
            success: function(response) {
                location.href = '/dashboard';
            },
            error: function(jqXHR, textStatus, errorThrown) {
                alert(errorThrown);
            }
        });
    });

    $('.home-notify-form').submit(function(e) {
        e.preventDefault();

        var email = $('#mobile-apps-notify-email').val(),
            emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!email) {
            return App.showError('Please enter your email');
        }
        if (!emailRegex.test(email)) {
            return App.showError('Please enter valid email');
        }

        $.ajax({
            url: '/subscriptions/mobile-apps',
            data: {
                email: email
            },
            type: 'post',
            dataType: 'json',
            success: function(response) {
                App.showNotification('Thank you. You will be notified when apps will be developed.');
                $('#mobile-apps-notify-email').val('');
            },
            error: function(jqXHR, textStatus, errorThrown) {
                App.showError('Internal error');
            }
        });
    });

    $('input[placeholder]').focus(function() {
        $(this).attr('data-placeholder', $(this).attr('placeholder'));
        $(this).attr('placeholder', '');
    }).blur(function() {
        $(this).attr('placeholder', $(this).attr('data-placeholder'));
    });

    $('.logout-btn').click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        var request = $.ajax({
            type: 'DELETE',
            url: '/api/v1.0/connection'
        });

        request.done(_.bind(location.reload, location));

        request.fail(function() {
            App.showError('Logout failed');
        });
    });

    setInterval(function() {
        $('.btn-try-demo-form').toggleClass('wiggle');
        setTimeout(function() {
            $('.btn-try-demo-form').toggleClass('wiggle');
        }, 1000);
    }, 3000);

    $('.btn-try-demo-form').click(function(e) {
        $('.url-tab-link').click();
        switch(userCountryCode) {
            case "ZA" :
                $('#url-input').val('http://www.dha.gov.za/images/PDFs/Birth%20Certificates/bi-154.pdf');
                break;
            default:
                $('#url-input').val('http://www.csac.ca.gov/pubs/forms/grnt_frm/gpaform.pdf');
                break;
        }
    });

    $('.url-tab-link').click(function(e) {
        $('#url-input').val('');
        $('.upload-btn-popup').css('display', 'block');
        setTimeout(function() {
            $('.upload-btn-popup').css('display', 'none');
        }, 3000);
    });
});
