var async = require('async'),
    router = require('./core/router'),
    components = require('./components'),
    microphone = require('./core/microphone');

require('./routes');

function init () {
    microphone.init(function () {
        async.each(components, function (component, callback) {
            component.init(callback);
        }, function () {
            router.run();
        });
    });
}

init();