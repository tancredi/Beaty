'use strict';

var WaveSurfer = {
    defaultParams: {
        height        : 128,
        waveColor     : '#999',
        progressColor : '#555',
        cursorColor   : '#333',
        selectionColor: '#0fc',
        cursorWidth   : 1,
        markerWidth   : 1,
        skipLength    : 2,
        minPxPerSec   : 1,
        samples       : 3,
        pixelRatio    : window.devicePixelRatio,
        fillParent    : true,
        scrollParent  : false,
        normalize     : false,
        audioContext  : null,
        container     : null,
        renderer      : 'Canvas',
        dragSelection : true,
        loopSelection : true,
        audioRate     : 1,
        interact      : true
    },

    init: function (params) {
        // Extract relevant parameters (or defaults)
        this.params = WaveSurfer.util.extend({}, this.defaultParams, params);

        // Marker objects
        this.markers = {};
        this.once('marked', this.bindMarks.bind(this));

        // Used to save the current volume when muting so we can
        // restore once unmuted
        this.savedVolume = 0;
        // The current muted state
        this.isMuted = false;

        this.loopSelection = this.params.loopSelection;
        this.minPxPerSec = this.params.minPxPerSec;

        this.createBackend();
        this.createDrawer();

        this.on('loaded', this.loadBuffer.bind(this));
    },

    createDrawer: function () {
        var my = this;

        this.drawer = Object.create(WaveSurfer.Drawer[this.params.renderer]);
        this.drawer.init(this.params);

        this.drawer.on('redraw', function () {
            my.drawBuffer();
        });

        this.on('progress', function (progress) {
            my.drawer.progress(progress);
        });

        // Click-to-seek
        this.drawer.on('mousedown', function (progress) {
            my.seekTo(progress);
        });

        // Drag selection events
        if (this.params.dragSelection) {
            this.drawer.on('drag', function (drag) {
                if (my.selMark0 && my.selMark0.percentage != drag.startPercentage) {
                    my.seekTo(drag.startPercentage);
                }

                my.updateSelection(drag);
            });
            this.drawer.on('drag-clear', function () {
                my.clearSelection();
            });
        }
    },

    createBackend: function () {
        var my = this;

        this.backend = Object.create(WaveSurfer.WebAudio);

        this.backend.on('play', function () {
            my.fireEvent('play');
        });

        this.on('play', function () {
            my.restartAnimationLoop();
        });

        this.backend.on('finish', function () {
            my.fireEvent('finish');
        });

        this.backend.init(this.params);
    },

    restartAnimationLoop: function () {
        var my = this;
        var requestFrame = window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame;
        var frame = function () {
            my.fireEvent('progress', my.backend.getPlayedPercents());
            if (!my.backend.isPaused()) {
                requestFrame(frame);
            }
        };
        frame();
    },

    getDuration: function () {
        return this.backend.getDuration();
    },

    getCurrentTime: function () {
        return this.backend.getCurrentTime();
    },

    playAt: function (percents) {
        this.backend.play(this.getDuration() * percents);
    },

    play: function () {
        this.backend.play();
    },

    pause: function () {
        this.backend.pause();
    },

    playPause: function () {
        this.backend.isPaused() ? this.play() : this.pause();
    },

    skipBackward: function (seconds) {
        this.skip(seconds || -this.params.skipLength);
    },

    skipForward: function (seconds) {
        this.skip(seconds || this.params.skipLength);
    },

    skip: function (offset) {
        var timings = this.timings(offset);
        var progress = timings[0] / timings[1];

        this.seekTo(progress);
    },

    seekTo: function (progress) {
        var paused = this.backend.isPaused();
        this.playAt(progress);
        if (paused) {
            this.pause();
        }
        this.fireEvent('seek', progress);
    },

    stop: function () {
        this.playAt(0);
        this.pause();
        this.drawer.progress(0);
    },

    /**
     * Set the playback volume.
     *
     * @param {Number} newVolume A value between 0 and 1, 0 being no
     * volume and 1 being full volume.
     */
    setVolume: function (newVolume) {
        this.backend.setVolume(newVolume);
    },

    /**
     * Toggle the volume on and off. It not currenly muted it will
     * save the current volume value and turn the volume off.
     * If currently muted then it will restore the volume to the saved
     * value, and then rest the saved value.
     */
    toggleMute: function () {
        if (this.isMuted) {
            // If currently muted then restore to the saved volume
            // and update the mute properties
            this.backend.setVolume(this.savedVolume);
            this.isMuted = false;
        } else {
            // If currently not muted then save current volume,
            // turn off the volume and update the mute properties
            this.savedVolume = this.backend.getVolume();
            this.backend.setVolume(0);
            this.isMuted = true;
        }
    },

    mark: function (options) {
        if (options.id && options.id in this.markers) {
            return this.markers[options.id].update(options);
        }

        var my = this;

        var opts = WaveSurfer.util.extend({
            id: WaveSurfer.util.getId(),
            position: this.getCurrentTime(),
            width: this.params.markerWidth
        }, options);

        var marker = Object.create(WaveSurfer.Mark);

        marker.on('update', function () {
            var duration = my.getDuration() || 1;
            if (null == marker.position) {
                marker.position = marker.percentage * duration;
            }
            // validate percentage
            marker.percentage = marker.position / duration;
            my.markers[marker.id] = marker;

            // redraw marker
            my.drawer.addMark(marker);
        });

        marker.on('remove', function () {
            my.drawer.removeMark(marker);
            delete my.markers[marker.id];
        });

        this.fireEvent('marked', marker);

        return marker.init(opts);
    },

    redrawMarks: function () {
        Object.keys(this.markers).forEach(function (id) {
            var marker = this.markers[id];
            this.drawer.addMark(marker);
        }, this);
    },

    clearMarks: function () {
        Object.keys(this.markers).forEach(function (id) {
            this.markers[id].remove();
        }, this);
    },

    timings: function (offset) {
        var position = this.getCurrentTime() || 0;
        var duration = this.getDuration() || 1;
        position = Math.max(0, Math.min(duration, position + (offset || 0)));
        return [ position, duration ];
    },

    drawBuffer: function () {
        if (this.params.fillParent && !this.params.scrollParent) {
            var length = this.drawer.getWidth();
        } else {
            length = Math.round(
                this.getDuration() * this.minPxPerSec
            );
        }

        this.drawer.drawPeaks(this.backend.getPeaks(length), length);
        this.drawer.progress(this.backend.getPlayedPercents());
        this.redrawMarks();
        this.fireEvent('redraw');
    },

    loadBuffer: function (data) {
        var my = this;
        this.backend.loadBuffer(data, function () {
            my.clearMarks();
            my.drawBuffer();
            my.fireEvent('ready');
        }, function () {
            my.fireEvent('error', 'Error decoding audio');
        });
    },

    /**
     * Loads an AudioBuffer.
     */
    loadDecodedBuffer: function (buffer) {
      this.backend.setBuffer(buffer);
      this.clearMarks();
      this.drawBuffer();
      this.fireEvent('ready');
    },

    onProgress: function (e) {
        if (e.lengthComputable) {
            var percentComplete = e.loaded / e.total;
        } else {
            // Approximate progress with an asymptotic
            // function, and assume downloads in the 1-3 MB range.
            percentComplete = e.loaded / (e.loaded + 1000000);
        }
        this.fireEvent('loading', Math.round(percentComplete * 100), e.target);
    },

    /**
     * Loads audio data from a Blob or File object.
     *
     * @param {Blob|File} blob Audio data.
     */
    loadArrayBuffer: function(blob) {
        var my = this;
        // Create file reader
        var reader = new FileReader();
        reader.addEventListener('progress', function (e) {
            my.onProgress(e);
        });
        reader.addEventListener('load', function (e) {
            my.fireEvent('loaded', e.target.result);
        });
        reader.addEventListener('error', function () {
            my.fireEvent('error', 'Error reading file');
        });
        reader.readAsArrayBuffer(blob);
    },

    /**
     * Loads an audio file via XHR.
     */
    load: function (url) {
        var my = this;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.send();
        xhr.responseType = 'arraybuffer';
        xhr.addEventListener('progress', function (e) {
            my.onProgress(e);
        });
        xhr.addEventListener('load', function () {
            if (200 == xhr.status) {
                my.fireEvent('loaded', xhr.response);
            } else {
                my.fireEvent('error', 'Server response: ' + xhr.statusText);
            }
        });
        xhr.addEventListener('error', function () {
            my.fireEvent('error', 'Error loading audio');
        });
        this.empty();
    },

    /**
     * Listens to drag'n'drop.
     * @param {HTMLElement|String} dropTarget Element or selector.
     */
    bindDragNDrop: function (dropTarget) {
        var my = this;

        // Bind drop event
        if (typeof dropTarget == 'string') {
            dropTarget = document.querySelector(dropTarget);
        }

        var dropActiveCl = 'wavesurfer-dragover';
        var handlers = {};

        // Drop event
        handlers.drop = function (e) {
            e.stopPropagation();
            e.preventDefault();
            dropTarget.classList.remove(dropActiveCl);
            var file = e.dataTransfer.files[0];
            if (file) {
                my.empty();
                my.loadArrayBuffer(file);
            } else {
                my.fireEvent('error', 'Not a file');
            }
        };
        // Dragover & dragleave events
        handlers.dragover = function (e) {
            e.stopPropagation();
            e.preventDefault();
            dropTarget.classList.add(dropActiveCl);
        };
        handlers.dragleave = function (e) {
            e.stopPropagation();
            e.preventDefault();
            dropTarget.classList.remove(dropActiveCl);
        };

        Object.keys(handlers).forEach(function (event) {
            dropTarget.addEventListener(event, handlers[event]);
        });

        this.on('destroy', function () {
            Object.keys(handlers).forEach(function (event) {
                dropTarget.removeEventListener(event, handlers[event]);
            });
        });
    },

    bindMarks: function () {
        var my = this;
        var prevTime = 0;

        this.backend.on('play', function () {
            // Reset marker events
            Object.keys(my.markers).forEach(function (id) {
                my.markers[id].played = false;
            });
        });

        this.backend.on('audioprocess', function (time) {
            Object.keys(my.markers).forEach(function (id) {
                var marker = my.markers[id];
                if (!marker.played || (my.loopSelection && marker.loopEnd)) {
                    if (marker.position <= time && marker.position >= prevTime) {
                        // Prevent firing the event more than once per playback
                        marker.played = true;

                        my.fireEvent('mark', marker);
                        marker.fireEvent('reached');
                    }
                }
            });
            prevTime = time;
        });
    },

    /**
     * Display empty waveform.
     */
    empty: function () {
        this.clearMarks();
        this.backend.loadEmpty();
        this.drawer.drawPeaks({ length: this.drawer.getWidth() }, 0);
    },

    /**
     * Remove events, elements and disconnect WebAudio nodes.
     */
    destroy: function () {
        this.fireEvent('destroy');
        this.clearMarks();
        this.unAll();
        this.backend.destroy();
        this.drawer.destroy();
    },

    updateSelection: function (selection) {
        var my = this;

        var percent0 = selection.startPercentage;
        var percent1 = selection.endPercentage;
        var color = this.params.selectionColor;

        if (percent0 > percent1) {
            var tmpPercent = percent0;
            percent0 = percent1;
            percent1 = tmpPercent;
        }

        if (this.selMark0) {
            this.selMark0.update({ percentage: percent0 });
        } else {
            this.selMark0 = this.mark({
                id: 'selMark0',
                percentage: percent0,
                color: color
            });
        }
        this.drawer.addMark(this.selMark0);

        if (this.selMark1) {
            this.selMark1.update({ percentage: percent1 });
        } else {
            this.selMark1 = this.mark({
                id: 'selMark1',
                percentage: percent1,
                color: color
            });
            this.selMark1.loopEnd = true;
            this.selMark1.on('reached', function(){
                my.backend.logLoop(my.selMark0.position, my.selMark1.position);
            });
        }
        this.drawer.addMark(this.selMark1);

        this.drawer.updateSelection(percent0, percent1);
        this.backend.updateSelection(percent0, percent1);
    },

    clearSelection: function () {
        if (this.selMark0) {
            this.selMark0.remove();
            this.selMark0 = null;
        }
        if (this.selMark1) {
            this.selMark1.remove();
            this.selMark1 = null;
        }
        this.drawer.clearSelection();
        this.backend.clearSelection();
    },

    toggleLoopSelection: function () {
        this.loopSelection = !this.loopSelection;
        this.drawer.loopSelection = this.loopSelection;
        this.backend.loopSelection = this.loopSelection;

        if (this.selMark0) this.selectionPercent0 = this.selMark0.percentage;
        if (this.selMark1) this.selectionPercent1 = this.selMark1.percentage;
        this.updateSelection();
        this.selectionPercent0 = null;
        this.selectionPercent1 = null;
    },

    getSelection: function () {
      if (!this.selMark0 || !this.selMark1) return null;

      var duration = this.getDuration();
      var startPercentage = this.selMark0.percentage;
      var endPercentage = this.selMark1.percentage;

      return {
          startPercentage: startPercentage,
          startPosition: startPercentage * duration,
          endPercentage: endPercentage,
          endPosition: endPercentage * duration
      };
    },

    enableInteraction: function () {
        this.drawer.interact = true;
    },

    disableInteraction: function () {
        this.drawer.interact = false;
    },

    toggleInteraction: function () {
        this.drawer.interact = !this.drawer.interact;
    },

};


/* Mark */
WaveSurfer.Mark = {
    defaultParams: {
        id: null,
        position: 0,
        percentage: 0,
        width: 1,
        color: '#333'
    },

    init: function (options) {
        return this.update(
            WaveSurfer.util.extend({}, this.defaultParams, options)
        );
    },

    getTitle: function () {
        var d = new Date(this.position * 1000);
        return d.getMinutes() + ':' + d.getSeconds();
    },

    update: function (options) {
        Object.keys(options).forEach(function (key) {
            if (key in this.defaultParams) {
                this[key] = options[key];
            }
        }, this);

        // If percentage is specified, but position is undefined,
        // let the subscribers to recalculate the position
        if (null == options.position && null != options.percentage) {
            this.position = null;
        }

        this.fireEvent('update');
        return this;
    },

    remove: function () {
        this.fireEvent('remove');
    }
};

/* Observer */
WaveSurfer.Observer = {
    on: function (event, fn) {
        if (!this.handlers) { this.handlers = {}; }

        var handlers = this.handlers[event];
        if (!handlers) {
            handlers = this.handlers[event] = [];
        }
        handlers.push(fn);
    },

    un: function (event, fn) {
        if (!this.handlers) { return; }

        var handlers = this.handlers[event];
        if (handlers) {
            if (fn) {
                for (var i = handlers.length - 1; i >= 0; i--) {
                    if (handlers[i] == fn) {
                        handlers.splice(i, 1);
                    }
                }
            } else {
                handlers.length = 0;
            }
        }
    },

    unAll: function () {
        this.handlers = null;
    },

    once: function (event, handler) {
        var fn = (function () {
            handler();
            this.un(event, fn);
        }).bind(this);
        this.on(event, fn);
    },

    fireEvent: function (event) {
        if (!this.handlers) { return; }

        var handlers = this.handlers[event];
        var args = Array.prototype.slice.call(arguments, 1);
        if (handlers) {
            for (var i = 0, len = handlers.length; i < len; i += 1) {
                handlers[i].apply(null, args);
            }
        }
    }
};

/* Common utilities */
WaveSurfer.util = {
    extend: function (dest) {
        var sources = Array.prototype.slice.call(arguments, 1);
        sources.forEach(function (source) {
            if (source != null) {
                Object.keys(source).forEach(function (key) {
                    dest[key] = source[key];
                });
            }
        });
        return dest;
    },

    getId: function () {
        return 'wavesurfer_' + Math.random().toString(32).substring(2);
    },

    max: function (values) {
        var max = -Infinity;
        for (var i = 0, len = values.length; i < len; i++) {
            var val = values[i];
            if (val > max) { max = val; }
        }
        return max;
    }
};

WaveSurfer.util.extend(WaveSurfer, WaveSurfer.Observer);
WaveSurfer.util.extend(WaveSurfer.Mark, WaveSurfer.Observer);
'use strict';

WaveSurfer.WebAudio = {
    scriptBufferSize: 256,

    init: function (params) {
        if (!(window.AudioContext || window.webkitAudioContext)) {
            throw new Error(
                'wavesurfer.js: your browser doesn\'t support WebAudio'
            );
        }
        this.params = params;
        this.loopSelection = this.params.loopSelection;
        this.ac = params.audioContext || this.getAudioContext();
        this.offlineAc = this.getOfflineAudioContext(this.ac.sampleRate);

        this.createVolumeNode();
        this.createScriptNode();        
        this.setPlaybackRate(this.params.audioRate);
    },

    setFilter: function (filterNode) {
        this.filterNode && this.filterNode.disconnect();
        this.gainNode.disconnect();
        if (filterNode) {
            filterNode.connect(this.ac.destination);
            this.gainNode.connect(filterNode);
        } else {
            this.gainNode.connect(this.ac.destination);
        }
        this.filterNode = filterNode;
    },

    createScriptNode: function () {
        var my = this;
        var bufferSize = this.scriptBufferSize;
        if (this.ac.createScriptProcessor) {
            this.scriptNode = this.ac.createScriptProcessor(bufferSize);
        } else {
            this.scriptNode = this.ac.createJavaScriptNode(bufferSize);
        }
        this.scriptNode.connect(this.ac.destination);
        this.scriptNode.onaudioprocess = function () {
            if (!my.isPaused()) {
                var time = my.getCurrentTime();
                if (time > my.scheduledPause) {
                    my.pause();
                    if (time > my.getDuration()) {
                        my.fireEvent('finish', time);
                    }
                }
                my.fireEvent('audioprocess', time);
            }
        };
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate: function (value) {
        this.playBackrate = value;
    },

    /**
     * Create the gain node needed to control the playback volume.
     */
    createVolumeNode: function () {
        // Create gain node using the AudioContext
        if (this.ac.createGain) {
            this.gainNode = this.ac.createGain();
        } else {
            this.gainNode = this.ac.createGainNode();
        }
        // Add the gain node to the graph
        this.gainNode.connect(this.ac.destination);
    },

    /**
     * Set the gain to a new value.
     *
     * @param {Number} newGain The new gain, a floating point value
     * between 0 and 1. 0 being no gain and 1 being maximum gain.
     */
    setVolume: function (newGain) {
        this.gainNode.gain.value = newGain;
    },

    /**
     * Get the current gain.
     *
     * @returns {Number} The current gain, a floating point value
     * between 0 and 1. 0 being no gain and 1 being maximum gain.
     */
    getVolume: function () {
        return this.gainNode.gain.value;
    },

    clearSource: function () {
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
    },

    refreshBufferSource: function () {
        this.clearSource();
        this.source = this.ac.createBufferSource();

        if (this.playBackrate) {
            this.source.playbackRate.value = this.playBackrate;
        }

        if (this.buffer) {
            this.source.buffer = this.buffer;
        }
        this.source.connect(this.gainNode);
    },

    setupLoop: function () {
        this.lastLoop = 0;
        this.loopedAtStart = false;

        if (this.loop && this.lastStart <= this.loopEnd) {
            this.loopedAtStart = true;
            this.source.loop = true;
            this.source.loopStart = this.loopStart;
            this.source.loopEnd = this.loopEnd;
        }
    },

    setBuffer: function (buffer) {
        this.clearSource();
        this.lastLoop = 0;
        this.lastPause = 0;
        this.lastStart = 0;
        this.startTime = 0;
        this.paused = true;
        this.buffer = buffer;
    },

    /**
     * Decodes binary data and creates buffer source.
     *
     * @param {ArrayBuffer} arraybuffer Audio data.
     * @param {Function} cb Callback on success.
     * @param {Function} errb Callback on error.
     */
    loadBuffer: function (arraybuffer, cb, errb) {
        var my = this;
        this.offlineAc.decodeAudioData(
            arraybuffer,
            function (buffer) {
                my.setBuffer(buffer);
                cb && cb(buffer);
            },
            errb
        );
    },

    loadEmpty: function () {
        this.setBuffer(null);
    },

    isPaused: function () {
        return this.paused;
    },

    getDuration: function () {
        return this.buffer ? this.buffer.duration : 0;
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of the track.
     *
     * @param {Number} end End offset in seconds,
     * relative to the beginning of the track.
     */
    play: function (start, end) {
        this.refreshBufferSource();

        if (null == start) { start = this.getCurrentTime(); }
        if (null == end) { end = this.getDuration(); }
        if (start > end) {
            start = 0;
        }

        this.lastStart = start;
        this.startTime = this.ac.currentTime;
        this.paused = false;
        this.scheduledPause = end;

        if (this.loopSelection) this.setupLoop();

        if (this.source.start) {
            this.source.start(0, start, end - start);
        } else {
            this.source.noteGrainOn(0, start, end - start);
        }

        this.fireEvent('play');
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        if (this.loopIsActive()) {
            this.lastPause = this.loopStart +
                this.ac.currentTime - this.lastLoop;
        } else {
            this.lastPause = this.lastStart +
                (this.ac.currentTime - this.startTime);
        }

        this.paused = true;
        if (this.source) {
            if (this.source.stop) {
                this.source.stop(0);
            } else {
                this.source.noteOff(0);
            }
            this.clearSource();
        }

        this.fireEvent('pause');
    },

    /**
     * @returns {Float32Array} Array of peaks.
     */
    getPeaks: function (length) {
        var buffer = this.buffer;
        var sampleSize = buffer.length / length;
        var sampleStep = ~~(sampleSize / 10);
        var channels = buffer.numberOfChannels;
        var peaks = new Float32Array(length);

        for (var c = 0; c < channels; c++) {
            var chan = buffer.getChannelData(c);
            for (var i = 0; i < length; i++) {
                var start = ~~(i * sampleSize);
                var end = ~~(start + sampleSize);
                var peak = 0;
                for (var j = start; j < end; j += sampleStep) {
                    var value = chan[j];
                    if (value > peak) {
                        peak = value;
                    } else if (-value > peak) {
                        peak = -value;
                    }
                }
                if (c > 0) {
                    peaks[i] += peak;
                } else {
                    peaks[i] = peak;
                }

                // Average peak between channels
                if (c == channels - 1) {
                    peaks[i] = peaks[i] / channels;
                }
            }
        }

        return peaks;
    },

    getPlayedPercents: function () {
        return (this.getCurrentTime() / this.getDuration()) || 0;
    },

    getCurrentTime: function () {
        if (this.isPaused()) {
            return this.lastPause;
        }

        if (this.loopIsActive()) {
            return this.loopStart + this.ac.currentTime - this.lastLoop;
        }

        return  this.lastStart + this.ac.currentTime - this.startTime;
    },

    audioContext: null,
    getAudioContext: function () {
        if (!WaveSurfer.WebAudio.audioContext) {
            WaveSurfer.WebAudio.audioContext = new (
                window.AudioContext || window.webkitAudioContext
            );
        }
        return WaveSurfer.WebAudio.audioContext;
    },

    offlineAudioContext: null,
    getOfflineAudioContext: function (sampleRate) {
        if (!WaveSurfer.WebAudio.offlineAudioContext) {
            WaveSurfer.WebAudio.offlineAudioContext = new (
                window.OfflineAudioContext || window.webkitOfflineAudioContext
            )(1, 2, sampleRate);
        }
        return WaveSurfer.WebAudio.offlineAudioContext;
    },

    destroy: function () {
        this.pause();
        this.unAll();
        this.buffer = null;
        this.filterNode && this.filterNode.disconnect();
        this.gainNode.disconnect();
        this.scriptNode.disconnect();
    },

    updateSelection: function(startPercent, endPercent) {
        if (!this.loopSelection) return false;

        var duration = this.getDuration();
        if (!duration) return;

        this.loop = true;
        this.loopStart = duration * startPercent;
        this.loopEnd = duration * endPercent;

        if (this.source) {
            this.source.loop = this.loop;
            this.source.loopStart = this.loopStart;
            this.source.loopEnd = this.loopEnd;
        }
    },

    clearSelection: function() {
        if (!this.loopSelection) return false;

        this.loop = false;
        this.loopStart = 0;
        this.loopEnd = 0;

        if (this.source) {
            this.source.loop = false;
            this.source.loopStart = this.loopStart;
            this.source.loopEnd = this.loopEnd;
        }
    },

    logLoop: function(){
        if (this.loopedAtStart) this.lastLoop = this.ac.currentTime;
    },

    loopIsActive: function () {
        return this.loopSelection &&
            this.loop &&
            this.lastLoop &&
            this.loopedAtStart;
    }
};

WaveSurfer.util.extend(WaveSurfer.WebAudio, WaveSurfer.Observer);
'use strict';

WaveSurfer.Drawer = {
    init: function (params) {
        this.container = 'string' == typeof params.container ?
            document.querySelector(params.container) :
            params.container;

        if (!this.container) {
            throw new Error('wavesurfer.js: container element not found');
        }

        this.params = params;
        this.pixelRatio = this.params.pixelRatio;
        this.loopSelection = this.params.loopSelection;

        this.width = 0;
        this.height = params.height * this.pixelRatio;
        this.containerWidth = this.container.clientWidth;
        this.interact = this.params.interact;

        this.lastPos = 0;

        this.createWrapper();
        this.createElements();
    },

    createWrapper: function () {
        this.wrapper = this.container.appendChild(
            document.createElement('wave')
        );
        this.style(this.wrapper, {
            display: 'block',
            position: 'relative',
            userSelect: 'none',
            webkitUserSelect: 'none',
            height: this.params.height + 'px'
        });

        if (this.params.fillParent || this.params.scrollParent) {
            this.style(this.wrapper, {
                width: '100%',
                overflowX: this.params.scrollParent ? 'scroll' : 'hidden',
                overflowY: 'hidden'
            });
        }

        this.setupWrapperEvents();
    },

    setupWrapperEvents: function () {
        var my = this;

        var handleEvent = function (e) {
            e.preventDefault();
            var relX = 'offsetX' in e ? e.offsetX : e.layerX;
            return (relX / my.scrollWidth) || 0;
        };

        this.wrapper.addEventListener('mousedown', function (e) {
            if (my.interact) {
                my.fireEvent('mousedown', handleEvent(e));
            }
        });

        this.params.dragSelection && (function () {
            var drag = {};

            var onMouseUp = function () {
                drag.startPercentage = drag.endPercentage = null;
            };
            document.addEventListener('mouseup', onMouseUp);
            my.on('destroy', function () {
                document.removeEventListener('mouseup', onMouseUp);
            });

            my.wrapper.addEventListener('mousedown', function (e) {
                e.stopPropagation();
                drag.startPercentage = handleEvent(e);
            });

            my.wrapper.addEventListener('mousemove', function (e) {
                if (drag.startPercentage != null) {
                    drag.endPercentage = handleEvent(e);
                    my.fireEvent('drag', drag);
                }
            });

            my.wrapper.addEventListener('dblclick', function (e) {
                my.fireEvent('drag-clear', drag);
            });
        }());
    },

    drawPeaks: function (peaks, length) {
        this.resetScroll();
        this.setWidth(length);
        if (this.params.normalize) {
            var max = WaveSurfer.util.max(peaks);
        } else {
            max = 1;
        }
        this.drawWave(peaks, max);
    },

    style: function (el, styles) {
        Object.keys(styles).forEach(function (prop) {
            el.style[prop] = styles[prop];
        });
    },

    resetScroll: function () {
        this.wrapper.scrollLeft = 0;
    },

    recenter: function (percent) {
        var position = this.containerWidth * percent;
        this.recenterOnPosition(position, true);
    },

    recenterOnPosition: function (position, immediate) {
        var scrollLeft = this.wrapper.scrollLeft;
        var half = ~~(this.containerWidth / 2);
        var target = position - half;
        var offset = target - scrollLeft;

        // if the cursor is currently visible...
        if (!immediate && offset >= -half && offset < half) {
            // we'll limit the "re-center" rate.
            var rate = 5;
            offset = Math.max(-rate, Math.min(rate, offset));
            target = scrollLeft + offset;
        }

        if (offset != 0) {
            this.wrapper.scrollLeft = target;
        }
    },

    getWidth: function () {
        return Math.round(this.containerWidth * this.pixelRatio);
    },

    setWidth: function (width) {
        if (width == this.width) { return; }

        this.width = width;
        this.scrollWidth = ~~(this.width / this.pixelRatio);
        this.containerWidth = this.container.clientWidth;

        if (!this.params.fillParent && !this.params.scrollParent) {
            this.style(this.wrapper, {
                width: this.scrollWidth + 'px'
            });
        }

        this.updateWidth();
    },

    progress: function (progress) {
        var minPxDelta = 1 / this.pixelRatio;
        var pos = Math.round(progress * this.width) * minPxDelta;

        if (pos < this.lastPos || pos - this.lastPos >= minPxDelta) {
            this.lastPos = pos;

            if (this.params.scrollParent) {
                var newPos = ~~(this.scrollWidth * progress);
                if (this.loopSelection && this.startPercent) {
                    if (this.startPercent <= progress && progress <= this.endPercent) {
                        var median = this.startPercent + (this.endPercent - this.startPercent) / 2;
                        newPos = ~~(this.scrollWidth * median);
                    }
                }
                this.recenterOnPosition(newPos);
            }

            this.updateProgress(progress);
        }
    },

    destroy: function () {
        this.unAll();
        this.container.removeChild(this.wrapper);
        this.wrapper = null;
    },

    updateSelection: function (startPercent, endPercent) {
        this.startPercent = startPercent;
        this.endPercent = endPercent;

        this.drawSelection();
    },

    clearSelection: function () {
        this.startPercent = null;
        this.endPercent = null;

        this.eraseSelection();
    },

    /* Renderer-specific methods */
    createElements: function () {},

    updateWidth: function () {},

    drawWave: function (peaks, max) {},

    clearWave: function () {},

    updateProgress: function (position) {},

    addMark: function (mark) {},

    removeMark: function (mark) {},

    redrawSelection: function () {},

    eraseSelection: function () {}

};

WaveSurfer.util.extend(WaveSurfer.Drawer, WaveSurfer.Observer);
'use strict';

WaveSurfer.Drawer.Canvas = Object.create(WaveSurfer.Drawer);

WaveSurfer.util.extend(WaveSurfer.Drawer.Canvas, {
    createElements: function () {
        this.marks = {};

        var waveCanvas = this.wrapper.appendChild(
            document.createElement('canvas')
        );
        this.style(waveCanvas, {
            position: 'absolute',
            zIndex: 1
        });

        var progressWave = this.wrapper.appendChild(
            document.createElement('wave')
        );
        this.style(progressWave, {
            position: 'absolute',
            zIndex: 2,
            overflow: 'hidden',
            width: '0',
            height: this.params.height + 'px',
            borderRight: [
                this.params.cursorWidth + 'px',
                'solid',
                this.params.cursorColor
            ].join(' ')
        });

        var progressCanvas = progressWave.appendChild(
            document.createElement('canvas')
        );

        var marksCanvas = this.wrapper.appendChild(
            document.createElement('canvas')
        );
        this.style(marksCanvas, {
            position: 'absolute',
            zIndex: 3
        });

        var selectionCanvas = this.wrapper.appendChild(
            document.createElement('canvas')
        );
        this.style(selectionCanvas, {
            position: 'absolute',
            zIndex: 0
        });

        this.canvases = [
            waveCanvas, progressCanvas, marksCanvas, selectionCanvas
        ];

        this.waveCc = waveCanvas.getContext('2d');
        this.progressCc = progressCanvas.getContext('2d');
        this.progressWave = progressWave;
        this.marksCc = marksCanvas.getContext('2d');
        this.selectionCc= selectionCanvas.getContext('2d');
    },

    updateWidth: function () {
        var width = Math.round(this.width / this.pixelRatio) + 'px';
        this.canvases.forEach(function (canvas) {
            canvas.width = this.width;
            canvas.height = this.height;
            canvas.style.width = width;
        }, this);

        this.clearWave();
    },

    clearWave: function () {
        this.waveCc.clearRect(0, 0, this.width, this.height);
        this.progressCc.clearRect(0, 0, this.width, this.height);
    },

    drawWave: function (peaks, max) {
        var $ = 0.5 / this.pixelRatio;
        this.waveCc.fillStyle = this.params.waveColor;
        this.progressCc.fillStyle = this.params.progressColor;

        var coef = this.height / max;
        var halfH = this.height / 2;

        this.waveCc.beginPath();
        this.waveCc.moveTo($, halfH);
        this.progressCc.beginPath();
        this.progressCc.moveTo($, halfH);
        for (var i = 0; i < this.width; i++) {
            var h = Math.round(peaks[i] * coef);
            this.waveCc.lineTo(i + $, halfH + h);
            this.progressCc.lineTo(i + $, halfH + h);
        }
        this.waveCc.lineTo(this.width + $, halfH);
        this.progressCc.lineTo(this.width + $, halfH);

        this.waveCc.moveTo($, halfH);
        this.progressCc.moveTo($, halfH);
        for (var i = 0; i < this.width; i++) {
            var h = Math.round(peaks[i] * coef);
            this.waveCc.lineTo(i + $, halfH - h);
            this.progressCc.lineTo(i + $, halfH - h);
        }

        this.waveCc.lineTo(this.width + $, halfH);
        this.waveCc.fill();
        this.progressCc.lineTo(this.width + $, halfH);
        this.progressCc.fill();
    },

    updateProgress: function (progress) {
        var pos = Math.round(
            this.width * progress
        ) / this.pixelRatio;
        this.progressWave.style.width = pos + 'px';
    },

    addMark: function (mark) {
        var redraw = mark.id in this.marks;
        this.marks[mark.id] = mark;
        redraw ? this.redrawMarks() : this.drawMark(mark);
    },

    removeMark: function (mark) {
        delete this.marks[mark.id];
        this.redrawMarks();
    },

    drawMark: function (mark) {
        this.marksCc.fillStyle = mark.color;
        var x = Math.min(
            this.width - mark.width,
            Math.max(0, Math.round(
                mark.percentage * this.width - mark.width / 2
            ))
        );
        this.marksCc.fillRect(x, 0, mark.width, this.height);
    },

    redrawMarks: function () {
        this.marksCc.clearRect(0, 0, this.width, this.height);
        Object.keys(this.marks).forEach(function (id) {
            this.drawMark(this.marks[id]);
        }, this);
    },

    drawSelection: function () {
        this.eraseSelection();

        this.selectionCc.fillStyle = this.params.selectionColor;
        var x = this.startPercent * this.width;
        var width = this.endPercent * this.width - x;

        this.selectionCc.fillRect(x, 0, width, this.height);
    },

    eraseSelection: function () {
        this.selectionCc.clearRect(0, 0, this.width, this.height);
    }

});

window.WaveSurfer = WaveSurfer;
