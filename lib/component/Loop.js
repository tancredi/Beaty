var Component = require('../core/Component');

var Loop = new Component('loop', {
    templateName: 'component/loop',
    data: { audio: null },
    methods: {
        play: function () {
            var self = this;

            if (!this.audio) { return; }

            this.audio.play();

            this.audio.addEventListener('ended', function () {
                self.play();
            });
        }
    },
    created: function () {
        this.$watch('audio', function (a) {
            this.play();
        });
    }
});

module.exports = Loop;