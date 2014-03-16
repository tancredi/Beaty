var Component = require('../core/Component');

var Recorder = new Component('recorder', {
    templateName: 'component/recorder',
    methods: {
        startRecording: function () {
            this.recording = true;
        },

        stopRecording: function () {
            this.recording = false;
        },

        toggleRecording: function () {
            if (this.recording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        }
    }
});

module.exports = Recorder;