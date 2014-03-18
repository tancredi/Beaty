var Component = require('../core/Component'),
    microphone = require('../core/microphone'),
    Rec = window.Recorder;

var URL = window.URL || window.webkitURL;

var Recorder = new Component('recorder', {
    templateName: 'component/recorder',
    methods: {
        startRecording: function () {
            this.rec = new Rec(microphone.stream);
            this.rec.start();
            this.isRecording = true;
        },

        stopRecording: function () {
            this.rec.stop();

            this.rec.getBlob(function (blob) {
                var audio = new Audio();
                audio.src = URL.createObjectURL(blob);
                audio.play();
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