/*global Handlebars*/
Ember.Handlebars.helper('newDocsInFolderCount', function(folder) {
    var count = folder.get('newDocumentsCount');
    return count ? '(' + count + ')' : '';
}, 'newDocumentsCount');

