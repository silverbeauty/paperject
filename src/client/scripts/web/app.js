window.App = {
    notificationTemplate: '<div id="notification-message" class="notification-message alert alert-dismissable alert-<%= type %>">' +
        '<button type="button" class="close" aria-hidden="true">&times;</button>' +
        '<% if (typeof percentsCompleted != "undefined") { %>' +
        '<div class="row">'+
            '<div class="col-xs-9"><%= message %></div>'+
            '<div class="col-xs-2"><div class="progress">' +
                '<div class="progress-bar" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" style="width: <%= percentsCompleted %>%"></div>'+
            '</div>'+
        '</div>'+
        '<% } else { %>' +
        '<%= message %></div>' +
        '<% } %>',
    props: {},
    'set': function(key, value) {
        this.props[key] = value;
    },
    'get': function(key) {
        return this.props[key];
    },

    clearNotificationMessage: function() {
        $('#notification-message').remove();
    },

    showError: function(message){
        this.clearNotificationMessage();
        message = this.insertLinks(message);

        var html = _.template(this.notificationTemplate)({
            type: 'danger',
            message: message
        });
        $('body').append(html);
        this.attachMessaageDismiss();
    },

    showNotification: function(message) {
        this.clearNotificationMessage();
        message = this.insertLinks(message);

        var html = _.template(this.notificationTemplate)({
            type: 'success',
            message: message
        });
        $('body').append(html);
        this.attachMessaageDismiss();
    },

    attachMessaageDismiss: function() {
        $('#notification-message .close').unbind('click');
        $('#notification-message .close').click(function(){
            $('#notification-message').remove();
        });
    },

    showProgress: function(message, percentsCompleted) {
        this.clearNotificationMessage();
        message = this.insertLinks(message);
        var html = _.template(this.notificationTemplate)({
            type: 'success',
            message: message,
            percentsCompleted: Math.round((percentsCompleted || 0) / 10) * 10 // round to 10%
        });
        $('body').append(html);
        this.attachMessaageDismiss();
    },

    insertLinks: function(message) {
        if (message && message.indexOf('_invite_more_friends_') !== -1) {
            message = message.replace('_invite_more_friends_', '<a href="/dashboard/documents?invite=true">invite more friends</a>');
            message = message.replace('_go_pro_', '<a href="/dashboard/documents?gopro=true">go Pro</a>');
        }

        return message;
    }
};
