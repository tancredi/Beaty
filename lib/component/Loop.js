var Component = require('../core/Component');

var Loop = new Component('loop', {
    templateName: 'component/loop',
    data: { workspace: null, mute: false },
    methods: {

        play: function () {
            if (!this.sound || this.mute) { return; }

            this.sound.play();
        },

        stop: function () {
            if (!this.sound) { return; }

            this.sound.pause();
            this.sound.currentTime = 0;
        }

    },
    created: function () {
        var self = this,
            workspace = this.$parent;

        workspace.$on('beat', function () {
            var beat = workspace.$data.beat,
                localBeat = beat - Math.floor(beat / self.signature) * self.signature + 1;

            if (localBeat === 1) {
                self.stop();
                self.play();
            }
        });

        this.$watch('loop', function () {
            this.play();
        });

        workspace.$watch('tempo', function () {
            self.sound.playbackRate = workspace.$data.tempo / self.tempo;
        });
    }
});

module.exports = Loop;