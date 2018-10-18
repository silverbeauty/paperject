App.LoginController = Ember.Controller.extend(Ember.Evented, {
    needs: ['application'],
    loginFailed: false,
    isProcessing: false,
    username: '',
    showLoginForm: true,
    signatureRequestTitle: '',
    signatureRequestError: '',
    creatingSignatureRequestAccount: false,
    queryParams: ['doc'],

    actions: {
        login: function() {
            this.setProperties({
                loginFailed: false,
                isProcessing: true
            });

            this.trigger('login', this.getProperties('username', 'password'), _.bind(this.onLoginFail, this));
        },

        switchToLoginForm: function() {
            this.set('showLoginForm', true);
        },

        createSignatureRequestAccount: function() {
            var accountCreated = function() {
                location.reload();
            };

            this.set('signatureRequestError', '');
            this.set('creatingSignatureRequestAccount', true);

            $.ajax({
                url: sprintf('/api/v1.0/connection'),
                type: 'POST',
                data: JSON.stringify({
                    action: 'register-signature-request-account',
                    doc: this.get('doc')
                }),
                contentType: 'application/json',
                cache: false,
                dataType: 'json',
                context: this,
                processData: false, // Don't process the files
                success: accountCreated,
                error: function(xhr, textStatus, errorThrown) {
                    if (xhr.status === 200) {
                        accountCreated();
                    } else {
                        var message = 'Failed to email document';

                        if (xhr.responseText) {
                            try {
                                message = JSON.parse(xhr.responseText).message;
                            } catch (e) {}
                        }

                        this.set('signatureRequestError', message);
                        this.set('creatingSignatureRequestAccount', true);
                    }
                }
            });
        }
    },

    init: function() {
        this._super();
        var signatureRequest = this.get('controllers.application.model.signatureRequest');

        if (signatureRequest) {
            this.set('username', signatureRequest.recipientEmail);
            this.set('signatureRequestTitle', 'You are invited to sign ' + (signatureRequest.docName || 'a document'));
            this.set('showLoginForm', signatureRequest.recipientExists);
            document.title = (signatureRequest.docName || 'Sign a Document') + ' - Paperjet';
        } else {
            document.title = 'Paperjet. Go Paperless';
        }
    },

    onLoginFail: function(xhr) {
        var error;
        if (xhr.responseText) {
            try {
                error = JSON.parse(xhr.responseText).message;
            } catch (e) {
                error = 'Error: ' + xhr.responseText;
            }
        } else {
            error = 'Unexpected error: ' + xhr.statusText;
        }

        this.setProperties({
            loginFailed: true,
            isProcessing: false,
            loginErrorMessage: error
        });
    }
});
