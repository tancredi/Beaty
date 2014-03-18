var getUserMedia = require('./get-user-media');

var out = {};

out.init = function (callback) {

    if (!getUserMedia) {
        return;
    }

    getUserMedia({ audio: true }, function (stream) {
        out.stream = stream;
        out.context = new window.webkitAudioContext();
        out.source = out.context.createMediaStreamSource(stream);

        if (callback) { callback(stream); }
    }, function (err) {
        throw err;
    });
};

module.exports = out;