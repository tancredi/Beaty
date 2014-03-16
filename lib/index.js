var async = require('async'),
    router = require('./core/router'),
    components = require('./components');

require('./routes');

function init () {
    async.each(components, function (component, callback) {
        component.init(callback);
    }, function () {
        router.run();
    });
}

init();