$(document).ready(function() {
    $('#support-dialog-form').validate({
        rules: {
            email: {
                required: true,
                email: true
            },
            subject: {
                required: true
            },
            message: {
                required: true
            }
        },

        highlight: function(label) {
            $(label).closest('.form-group').addClass('has-error');
            $(label).closest('.form-group').find('.form-control-feedback').removeClass('hidden');
        },

        unhighlight: function(label) {
            $(label).closest('.form-group').removeClass('has-error');
            $(label).closest('.form-group').find('.form-control-feedback').addClass('hidden');
        },

        errorPlacement: function(error, element) {
            $(element).closest('.form-group').find('.form-control-feedback').tooltip().prop('title', $(error).text());
        },

        submitHandler: function() {
            $('#support-dialog-info-container').html('');
            $('#support-dialog-error-container').html('');
            $('#support-dialog-send-btn').prop('disabled', true);

            $.ajax({
                url: '/api/v1.0/support',
                dataType: 'json',
                contentType: 'application/json',
                cache: false,
                type: 'post',
                data: JSON.stringify({
                    email: $('#support-dialog-email-field').val(),
                    subject: $('#support-dialog-subject-field').val(),
                    message: $('#support-dialog-message-field').val()
                }),
                success: function(response) {
                    $('#support-dialog-info-container').html('Thanks! Your mail is on it\'s way and we hope to respond shortly :) - Paperjet Team');
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    if (jqXHR.status === 201) {
                        $('#support-dialog-info-container').html('Thanks! Your mail is on it\'s way and we hope to respond shortly :) - Paperjet Team');
                    } else {
                        $('#support-dialog-error-container').html('Eeek! Looks like we hit a speedbump sending your message. Please try our email <a href="mailto:hello@paperjet.com">hello@paperjet.com</a>');
                    }
                },
                complete: function() {
                    $('.title-box .title-description').css('display', 'none');
                    $('#support-dialog-send-btn').prop('disabled', false);
                    $('#support-dialog-form').css('display', 'none');

                }
            });
        }
    });
});
