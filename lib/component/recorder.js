var Component = require('../core/Component'),
    microphone = require('../core/microphone'),
    Rec = window.Recorder;

var URLlib = window.URL || window.webkitURL;

var Recorder = new Component('recorder', {
    templateName: 'component/recorder',
    data: { model: [] },
    methods: {
        startRecording: function () {
            this.rec = new Rec(microphone.source);
            this.rec.start();
            this.isRecording = true;
        },

        stopRecording: function () {
            var self = this;

            this.rec.stop();

            this.rec.getBlob(function (blob) {
                var audio = new Audio();
                audio.src = URLlib.createObjectURL(blob);
                self.model.push(audio);
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
    }
});

module.exports = Recorder;