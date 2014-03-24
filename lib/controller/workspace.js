var sound = require('../core/sound'),
    blobUtil = require('../util/blob'),
    async = require('async'),
    fileUploader = require('../util/file-uploader');

module.exports = function (data) {
    data.tempo = 120;
    data.beat = data.beatDisplay = -1;
    data.signature = 4;
    data.metronome = localStorage.metronome === 'true';

    this.save = function () {
        if (!this.recordings || !this.recordings.length) { return; }

        async.map(this.recordings, function (recording, callback) {

            blobUtil.encode(recording.blob, function (res) {
                callback(null, {
                    blob: res,
                    label: recording.label,
                    tempo: recording.tempo,
                    signature: recording.signature,
                    mute: recording.mute
                });
            });

        }, function (err, samples) {
            localStorage.samples = JSON.stringify(samples);
        });
    };

    this.loadSamples = function (samples) {
        samples.forEach(function (sample) {
            var blob = blobUtil.decode(sample.blob, 'audio/wav');

            if (!this.recordings) {
                this.recordings = [];
            }

            this.recordings.push({
                blob: blob,
                signature: sample.signature,
                tempo: sample.tempo,
                mute: sample.mute
            });
        }.bind(this));
    };

    this.loadFromStorage = function () {
        if (!localStorage.samples) { return; }

        this.loadSamples(JSON.parse(localStorage.samples));
    };

    this.load = function () {
        fileUploader.open(function (dataURL) {
            console.log(dataURL);
        });
    };

    this.loop = function () {
        var tempo = data.tempo > 30 ? data.tempo : 80;

        data.beat += 1;

        data.beatDisplay = data.beat - Math.floor(data.beat / 4) * 4 + 1;

        if (data.metronome) {
            sound.play('metronome' + (data.beatDisplay === 1 ? '-first' : ''));
        }

        this.$emit('beat');

        setTimeout(function () {
            this.loop();
        }.bind(this), 60000 / tempo);
    };

    this.$watch('metronome', function (val) {
        localStorage.metronome = val;
    });

    this.loop();

    this.loadFromStorage();
};