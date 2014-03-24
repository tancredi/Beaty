var Component = require('../core/Component'),
    context = require('../core/audio-context'),
    URLlib = require('../util/url-lib'),
    _ = require('lodash');

var WaveSurfer = window.WaveSurfer;

var waveSurferDefaults = {
    waveColor: 'rgba(34, 34, 34, .1)',
    progressColor: 'rgba(34, 34, 34, .1)',
    fillParent: true,
    normalize: true,
    dragSelection: false,
    loopSelection: false,
    cursorColor: 'transparent',
    interact: false
};

var Loop = new Component('loop', {
    templateName: 'component/loop',
    data: { workspace: null, mute: false },
    methods: {

        initPlayer: function () {
            var waveElement = this.$el.querySelector('.waveform'),
                timeBeforeLoading;

            this.player =  Object.create(WaveSurfer);

            this.player.init(_.extend(waveSurferDefaults, {
                container: waveElement,
                audioContext: context,
            }));

            timeBeforeLoading = new Date().getTime();

            this.player.loadArrayBuffer(this.blob);

            this.player.on('ready', function () {
                var delay = (new Date().getTime() - timeBeforeLoading) / 1000;
                this.player.skip(delay);
                this.play();
                this.updatePlaybackRate();
            }.bind(this));
        },

        play: function () {
            if (!this.player || this.mute) { return; }

            this.player.play();
        },

        stop: function () {
            if (!this.player) { return; }

            this.player.stop();
        },

        updatePlaybackRate: function () {
            var value = this.$parent.$data.tempo / this.tempo;
            this.player.backend.setPlaybackRate(value);
        },

        remove: function () {
            if (this.$parent.recordings) {
                this.$parent.recordings.forEach(function (loop) {
                    if (loop.blob === this.blob) {
                        loop.canceled = true;
                    }
                }.bind(this));
            }

            this.stop();
        }

    },
    created: function () {
        var workspace = this.$parent;

        this.audio = new Audio();
        this.audio.src = URLlib.createObjectURL(this.blob);

        setTimeout(this.initPlayer.bind(this), 1);

        workspace.$on('beat', function () {
            if (this.canceled) { return; }

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

        this.$watch('mute', function () {
            if (this.mute) {
                this.stop();
            }
        });

        workspace.$watch('tempo', function () {
            if (this.canceled) { return; }

            this.updatePlaybackRate();
        }.bind(this));

        setTimeout(function () {
            this.label = this.index;
        }.bind(this), 10);

        this.$watch('label', function (val) {
            if (typeof val !== 'string') {
                return;
            }

            if (this.label.indexOf('\n') !== -1) {
                this.label = this.label.replace('\n', '');
            }

            if (this.label.length > 10) {
                this.label = this.label.substr(0, 10);
            }
        }.bind(this));
    }
});

module.exports = Loop;