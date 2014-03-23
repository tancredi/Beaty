var Component = require('../core/Component'),
    microphone = require('../core/microphone'),
    Rec = window.Recorder;

var URLlib = window.URL || window.webkitURL;

var Recorder = new Component('recorder', {
    templateName: 'component/recorder',
    data: { model: [], workspace: null },
    methods: {

        recordNext: function () {
            if (this.isRecording) { return; }

            this.isPreparing = true;
        },

        startRecording: function () {
            this.rec = new Rec(microphone.source);
            this.rec.start();
            this.isPreparing = false;
            this.isRecording = true;
        },

        stopRecording: function () {
            var self = this,
                workspace = this.$parent;

            this.rec.stop();

            this.rec.getBlob(function (blob) {
                var audio = new Audio();

                audio.src = URLlib.createObjectURL(blob);

                self.model.push({
                    sound: audio,
                    blob: blob,
                    signature: workspace.$data.signature,
                    tempo: workspace.$data.tempo
                });

                self.rec.clear();
            });

            this.isRecording = false;
        },

        toggleRecording: function () {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        }
    },
    created: function () {
        var self = this,
            workspace = this.$parent;

        this.$parent.$on('beat', function () {
            var beat = workspace.$data.beat,
                signature = workspace.$data.signature,
                localBeat = beat - Math.floor(beat / signature) * signature + 1;

            if (localBeat === 1) {
                if (self.isRecording) {
                    self.stopRecording();
                }

                if (self.isPreparing) {
                    self.startRecording();
                }
            }
        });
    }
});

module.exports = Recorder;