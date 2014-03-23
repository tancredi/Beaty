var sound = require('../core/sound');

module.exports = function (data) {
    data.tempo = 120;
    data.beat = data.beatDisplay = -1;
    data.signature = 4;
    data.metronome = localStorage.metronome === 'true';

    this.loop = function () {
        var self = this;

        data.beat += 1;

        data.beatDisplay = data.beat - Math.floor(data.beat / 4) * 4 + 1;

        if (data.metronome) {
            sound.play('metronome' + (data.beatDisplay === 1 ? '-first' : ''));
        }

        this.$emit('beat');

        setTimeout(function () {
            self.loop();
        }, 60000 / data.tempo);
    };

    this.$watch('metronome', function (val) {
        localStorage.metronome = val;
    });

    this.loop();
};