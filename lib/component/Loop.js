var Component = require('../core/Component'),
    WaveSurfer = require('wavesurfer.js'),
    context = require('../core/audio-context');

var Loop = new Component('loop', {
    templateName: 'component/loop',
    data: { workspace: null, mute: false },
    methods: {

        initSound: function () {
            var waveElement = this.$el.querySelector('.waveform'),
                timeBeforeLoading;

            this.player =  Object.create(WaveSurfer);

            this.player.init({
                container: waveElement,
                waveColor: 'rgba(51, 51, 51, .1)',
                progressColor: 'rgba(51, 51, 51, .1)',
                fillParent: true,
                normalize: true,
                dragSelection: false,
                loopSelection: false,
                cursorColor: 'transparent',
                audioContext: context,
                interact: false
            });

            timeBeforeLoading = new Date().getTime();

            this.player.loadArrayBuffer(this.blob);

            this.player.on('ready', function () {
                var delay = (new Date().getTime() - timeBeforeLoading) / 1000;
                this.player.skip(delay);
                this.play();
            }.bind(this));
        },

        play: function () {
            if (!this.player || this.mute) { return; }

            this.player.play();
        },

        stop: function () {
            if (!this.player) { return; }

            this.player.stop();
        }

    },
    created: function () {
        var workspace = this.$parent;

        setTimeout(this.initSound.bind(this), 1);

        workspace.$on('beat', function () {
            var beat = workspace.$data.beat,
                localBeat = beat - Math.floor(beat / this.signature) * this.signature + 1;

            if (localBeat === 1) {
                this.stop();
                this.play();
            }
        }.bind(this));

        this.$watch('loop', function () {
            this.play();
        });

        workspace.$watch('tempo', function () {
            this.sound.playbackRate = workspace.$data.tempo / this.tempo;
        }.bind(this));
    }
});

module.exports = Loop;