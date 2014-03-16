var sound = require('../core/sound');

module.exports = function (data) {
    data.tempo = 80;
    data.beat = data.beatDisplay = -1;
    data.signature = 4;
    data.metronome = localStorage.metronome === 'true';

    this.loop = function () {
        var self = this;

        data.beat += 1;

        if (data.beat > 4) {
            data.beat = 1;
        }

        data.beatDisplay = data.beat % data.signature + 1;

        if (data.metronome) {
            sound.play('metronome' + (data.beatDisplay === 1 ? '-first' : ''));
        }

        setTimeout(function () {
            self.loop();
        }, 60000 / data.tempo);
    };

    this.$watch('metronome', function (val) {
        localStorage.metronome = val;
    });

    this.loop();
};