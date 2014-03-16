var microphone = require('../core/microphone'),
    getUserMedia = require('../core/get-user-media');

var conf = {
    is_recording: false,
    leftchannel: [],
    rightchannel: [],
    recordingLength: 0
};

var AudioContext = window.AudioContext || window.webkitAudioContext;

function Recording () {
    if (!getUserMedia) {
        return;
    }

    this.sampleRate = 44100;
    this.errors = [];
    this.sample();
}

Recording.prototype.sample = function () {
    var ctx = new AudioContext(),
        volume = ctx.createGain(),
        audioInput = ctx.createMediaStreamSource(microphone.stream),
        bufferSize = 1024,
        recorder;

    audioInput.connect(volume);

    recorder = ctx.createScriptProcessor(bufferSize, 2, 2);

    /* From the spec: This value controls how frequently the audioprocess event is 
    dispatched and how many sample-frames need to be processed each call. 
    Lower values for buffer size will result in a lower (better) latency. 
    Higher values will be necessary to avoid audio breakup and glitches */
    recorder.onaudioprocess = function (e) {
        var left, right;

        if (!conf.is_recording) {
            return;
        }

        left = e.inputBuffer.getChannelData(0);
        right = e.inputBuffer.getChannelData(1);

        conf.leftchannel.push(new Float32Array(left));
        conf.rightchannel.push(new Float32Array(right));

        return conf.recordingLength += bufferSize;
    };

    volume.connect(recorder);

    return recorder.connect(ctx.destination);
};

Recording.prototype.start = function() {
    conf.is_recording = true;
    conf.leftchannel = [];
    conf.rightchannel = [];
    conf.recordingLength = 0;
};

Recording.prototype.stop = function() {
    var buffer, i, index, interleaved, leftBuffer, lng, recording, rightBuffer, view, volume;
    recording = false;
    leftBuffer = this._mergeBuffers(conf.leftchannel, conf.recordingLength);
    rightBuffer = this._mergeBuffers(conf.rightchannel, conf.recordingLength);
    interleaved = this._interleave(leftBuffer, rightBuffer);
    buffer = new ArrayBuffer(44 + interleaved.length * 2);
    view = new DataView(buffer);
    this._writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 44 + interleaved.length * 2, true);
    this._writeUTFBytes(view, 8, 'WAVE');
    this._writeUTFBytes(view, 12, 'fmt');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, conf.sampleRate, true);
    view.setUint32(28, conf.sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    this._writeUTFBytes(view, 36, 'data');
    view.setUint32(40, interleaved.length * 2, true);
    lng = interleaved.length;
    index = 44;
    volume = 1;
    i = 0;
    while (i < lng) {
        view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
        index += 2;
        i += 1;
    }

    this.blob = new Blob([view], {
        type: 'audio/wav'
    });

    this.url = (window.URL || window.webkitURL).createObjectURL(this.blob);
};

Recording.prototype.download = function (fileName) {
    var click, link;

    if (fileName === null) {
            fileName = 'output.wav';
    }

    link = window.document.createElement('a');
    link.href = this.url;
    link.download = fileName;
    click = document.createEvent('Event');
    click.initEvent('click', true, true);
    return link.dispatchEvent(click);
};

Recording.prototype._interleave = function (leftChannel, rightChannel) {
    var index, inputIndex, length, result;
    length = leftChannel.length + rightChannel.length;
    result = new Float32Array(length);
    inputIndex = 0;
    index = 0;
    while (index < length) {
            result[index++] = leftChannel[inputIndex];
            result[index++] = rightChannel[inputIndex];
            inputIndex++;
    }
    return result;
};

Recording.prototype._mergeBuffers = function (channelBuffer, recordingLength) {
    var buffer, i, lng, offset, result;
    result = new Float32Array(recordingLength);
    offset = 0;
    lng = channelBuffer.length;
    i = 0;

    while (i < lng) {
            buffer = channelBuffer[i];
            result.set(buffer, offset);
            offset += buffer.length;
            i++;
    }
    return result;
};

Recording.prototype._writeUTFBytes = function (view, offset, string) {
    var i, lng, _results;

    lng = string.length;
    i = 0;
    _results = [];

    while (i < lng) {
            view.setUint8(offset + i, string.charCodeAt(i));
            _results.push(i++);
    }

    return _results;
};

module.exports = Recording;