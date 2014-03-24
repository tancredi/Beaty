var getUserMedia = require('../util/get-user-media'),
    context = require('./audio-context');

var out = {};

out.init = function (callback) {

    if (!getUserMedia) {
        return;
    }

    getUserMedia({ audio: true }, function (stream) {
        out.stream = stream;
        out.context = context;
        out.source = out.context.createMediaStreamSource(stream);

        if (callback) { callback(stream); }
    }, function (err) {
        throw err;
    });
};

module.exports = out;