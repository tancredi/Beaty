var Vue = require('vue'),
    template = require('./template');

function Component (name, options) {
    this.name = name;
    this.options = options;
    this.templateName = options.templateName;
}

Component.prototype.init = function (callback) {
    var self = this;

    template.load(this.templateName, function (template) {
        self.options.template = template;
        self.component = Vue.component(self.name, self.options);

        if (callback) { callback(self); }
    });
};

module.exports = Component;