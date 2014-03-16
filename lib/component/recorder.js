var Component = require('../core/Component'),
    Recording = require('../class/Recording');

var Recorder = new Component('recorder', {
    templateName: 'component/recorder',
    methods: {
        startRecording: function () {
            this.sound = new Recording();
            this.sound.start();
            this.recording = true;
        },

        stopRecording: function () {
            this.sound.stop();
            this.recording = false;
            console.log(this.sound);
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