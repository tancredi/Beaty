var Router = require('routy').Router,
    Vue = require('vue'),
    template = require('./template');

var router = new Router(),
    viewWrap = document.getElementById('view'),
    templatePath = '/view/';

function changeView (req) {
    if (!req.route.template) {
        var templateName = templatePath + req.route.options.templateName;

        return template.load(templateName, function (template) {
            req.route.template = template;
            changeView(req);
        });
    }

    viewWrap.innerHTML = req.route.template;
    var view = new Vue({ el: viewWrap, data: {}, methods: {} });

    if (req.route.options.controller) {
        req.route.options.controller.call(view, view.$data);
    }
}

router.on('change', changeView);

module.exports = router;