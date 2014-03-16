var http = require('superagent');

var loaded = {};

function loadTemplate (name, callback) {
    var path = name + '.html';

    if (loaded[name]) {
        return callback(loaded[name]);
    }

    http.get(path, function (data) {
        var template = data.text;

        loaded[name] = template;

        callback(template);
    });
}

module.exports = {
    load: loadTemplate
};