var SoundEffectsManager = require('sound-effect-manager');

var soundsPath = '/sounds/',
    sounds = [
        'metronome',
        'metronome-first'
    ];

var sm = new SoundEffectsManager();

sounds.forEach(function (sound) {
    sm.loadFile(soundsPath + sound + '.wav', sound);
});

function playSound (name) {
    sm.play(name);
}

module.exports = {
    play: playSound
};