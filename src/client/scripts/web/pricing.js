$(document).ready(function() {
    $('#toggle-monthly').click(function() {
        $('#toggle-monthly').addClass('active');
        $('#toggle-annual').removeClass('active');

        $('.monthly-visible').show();
        $('.annual-visible').hide();
    });

    $('#toggle-annual').click(function() {
        $('#toggle-monthly').removeClass('active');
        $('#toggle-annual').addClass('active');

        $('.annual-visible').show();
        $('.monthly-visible').hide();
    });

    $('#toggle-monthly').click();
});
