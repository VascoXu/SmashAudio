document.addEventListener("DOMContentLoaded", function() {
    
    var deleteAudio = undefined;
    var first = true;
    var zoomLevel = 0;
    var history = [];

    // Create waveform with Wavesurfer.js
    var wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        backend: 'WebAudio',
        showTime: true,
        scrollParent: true, 
        customShowTimeStyle: {
            'background-color': '#000',
            color: '#fff',
            padding: '2px',
            'font-size': '10px'
        },
        plugins: [
            WaveSurfer.cursor.create({
                opacity: 1, 
            }),
            WaveSurfer.regions.create({
                dragSelection: {
                    drag: false,
                    slop: 1,
                    loop : false,   
                }
            }),
            WaveSurfer.timeline.create({
                container: '#wave-timeline',
            })
        ]
    });

    // Replace selected region with "delete"
    document.getElementById("replace").addEventListener("click", function(){
        var regions = wavesurfer.regions.list;
        var keys = Object.keys(regions);

        if (keys.length > 0) {
            var start = regions[keys[0]].start;
            var end = regions[keys[0]].end;
            
            var part1 = slice(wavesurfer.backend.buffer, 0, start); 
            var middle = createDeleteAudio(start, end);
            var part2 = slice(wavesurfer.backend.buffer, end, wavesurfer.getDuration());
            
            var concat = concatenateAudioBuffers(part1, middle);
            concat  = concatenateAudioBuffers(concat, part2);
            
            history.push(concat);

            wavesurfer.loadDecodedBuffer(concat)
        };
    });

    // Revert changes
    document.getElementById("revert").addEventListener("click", function(){
        history.pop();
        var prev = history[history.length - 1];
        if (prev) {
            wavesurfer.loadDecodedBuffer(prev);
        }
    }); 

    // Action listener for play button
    document.getElementById("play").addEventListener("click", function(){
        var regions = wavesurfer.regions.list;
        var keys = Object.keys(regions);
        if (keys.length >= 1) {
            var start = regions[keys[0]].start;
            var end = regions[keys[0]].end;
            wavesurfer.play(start, end);  
        }
        else {
            wavesurfer.playPause();
        }
    });

    // Action listener for playing 1x speed
    document.getElementById("play-1x").addEventListener("click", function(){
        wavesurfer.setPlaybackRate(1);
    });

    // Action listener for playing 2x speed
    document.getElementById("play-2x").addEventListener("click", function(){
        wavesurfer.setPlaybackRate(1.5);
    });
 
    // Action listener for pause button
    document.getElementById("pause").addEventListener("click", function(){
        wavesurfer.pause();
    });

    // Action listener for pause button
    document.getElementById("fast-backward").addEventListener("click", function(){
        var currentTime = wavesurfer.getCurrentTime();
        if (currentTime - 5 > 0) {
            wavesurfer.setCurrentTime(currentTime - 5);
        }
    });
        
    // Action listener for pause button
    document.getElementById("fast-forward").addEventListener("click", function(){
        var currentTime = wavesurfer.getCurrentTime();
        var duration = wavesurfer.getDuration();
        
        if (currentTime + 5 < duration) {
            wavesurfer.setCurrentTime(currentTime + 5);
        }
    });

    // Action listener for zoom-in
    document.getElementById("zoom-in").addEventListener("click", function() {
        if (wavesurfer.backend.buffer && zoomLevel < 100) {
            zoomLevel += 1;
            wavesurfer.zoom(zoomLevel);
        }
    });

    // Action listener for zoom-out
    document.getElementById("zoom-out").addEventListener("click", function() {
        if (wavesurfer.backend.buffer && zoomLevel > 0) {
            zoomLevel -= 1;
            wavesurfer.zoom(zoomLevel);
        }
    });

    // Action listener for download button
    document.getElementById("download").addEventListener("click", function(){
        if (wavesurfer.backend.buffer) {
            var buffer = wavesurfer.backend.buffer;
            var length = wavesurfer.backend.buffer.length;
            
            var filename = prompt("Please enter a filename: "); 
            if (filename == null || filename == "") {
                alert("Invalid filename!");
              } else {
                var download_link = document.getElementById("download-link");
                download_link.href = URL.createObjectURL(bufferToWave(buffer, length));
                download_link.download = filename;
                download_link.click();
                download_link.remove();                
              }
        }
    });

    // Handle choose file and loading thereof
    document.getElementById("choose-file").addEventListener('change', function(e) {
        // Merge audio files
        if (this.files.length > 0) {
            // Display loading until loaded
            $('#loading').show();
            mergeAudio(this.files).then(result => {    
                // Reset first
                first = true;
    
                // Load the AudioBuffer into Wavesurfer
                wavesurfer.loadDecodedBuffer(result);
            })
        }

        /*
        var file = this.files[0];

        if (file) {
            // Display loading until loaded
            $('#loading').show();

            var reader = new FileReader();
            
            reader.onload = function (event) {
                // Create a Blob providing as first argument a typed array with the file buffer
                var blob = new window.Blob([new Uint8Array(event.target.result)]);

                // Reset first
                first = true;

                // Load the blob into Wavesurfer
                wavesurfer.loadBlob(blob);
            };

            reader.onerror = function (evt) {
                console.error("An error ocurred reading the file: ", evt);
            };

            // Read File as an ArrayBuffer
            reader.readAsArrayBuffer(audio);
        }
        */
    }, false);

    // Runs when Wavesurfer.js is ready
    wavesurfer.on('ready', function() {
        // Hide loading bar
        $('#loading').hide();

        // Insert buffer into history
        if (first) {
            // Get current zoom level
            zoomLevel = getZoomLevel();
            
            // Save first history
            history = [];
            history.push(wavesurfer.backend.buffer);
            first = !first;
        }

        // Determine source of delete audio
        var numChannels = wavesurfer.backend.buffer.numberOfChannels;
        var deleteSrc = `static/media/delete${numChannels}.wav`;

        fetch(deleteSrc)
        .then(response => response.arrayBuffer())
        .then(data => {
          wavesurfer.backend.ac.decodeAudioData(data).then(decodedData => {
            deleteAudio = decodedData;
          });
        });
    });

    // Runs when audio is playing (used to display time)
    wavesurfer.on("audioprocess", function() {
        if(wavesurfer.isPlaying()) {
            // Display current time 
            var seconds = wavesurfer.getCurrentTime();
            var formattedTime = secondsToTimestamp(seconds);
            document.getElementById("current-time").innerText = formattedTime;
        }
    });

    // Runs when region is updated (only allow one region)
    wavesurfer.on('region-updated', function(region){
        var regions = region.wavesurfer.regions.list;
        var keys = Object.keys(regions);
        if (keys.length > 1) {
            regions[keys[0]].remove();
        }
    });

    // Runs when player is clicked (used to clear regions)
    wavesurfer.drawer.on('click', function (e) {
        // Clear dragged regions on click
        wavesurfer.clearRegions();

        // Display current time 
        var seconds = wavesurfer.getCurrentTime();
        var formattedTime = secondsToTimestamp(seconds);
        document.getElementById("current-time").innerText = formattedTime;
    });

    /*
    // Add listener for file drop
    document.addEventListener("ondrop", function(event) {
        console.log('File(s) dropped');
      
        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();
      
        if (ev.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            for (var i = 0; i < ev.dataTransfer.items.length; i++) {
                // If dropped items aren't files, reject them
                if (ev.dataTransfer.items[i].kind === 'file') {
                    var file = ev.dataTransfer.items[i].getAsFile();
                    console.log('... file[' + i + '].name = ' + file.name);
                }
            }
        } 
        else {
            // Use DataTransfer interface to access the file(s)
            for (var i = 0; i < ev.dataTransfer.files.length; i++) {
                console.log('... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
            }
        }
    });

    // Add listener for file drop
    document.addEventListener("drop", function(event) {
        console.log('File(s) dropped');
      
        // Prevent default behavior (Prevent file from being opened)
        event.preventDefault();
      
        if (event.dataTransfer.items) {
            // Use DataTransferItemList interface to access the file(s)
            
        }
    });

    // Add listener for file drop
    document.addEventListener("dragover", function(event) {
        // Prevent default behavior (Prevent file from being opened)
        event.preventDefault();
    });
    */

     var mergeAudio = async function(files) {
        var master = undefined;
        for (let i = 0; i < files.length; i++) {
            file = files[i];

            // Create audio buffer from file
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Concatenate to previous audio buffer
            if (master) {
                master = concatenateAudioBuffers(master, audioBuffer);
            }
            else {
                master = audioBuffer;
            }
        }
        return master;
    }

    // Create delete sound
    function createDeleteAudio(start, end) {
        var length = (end - start);
        var splices = length / 0.78;
        var deleteSoundclip = deleteAudio;
        for (var i = 0; i < Math.ceil(splices); i++) {
            deleteSoundclip = concatenateAudioBuffers(deleteSoundclip, deleteAudio);
        }
        deleteSoundclip = slice(deleteSoundclip, 0, length);
        return deleteSoundclip;
    }

    // Slice  buffer
    // https://github.com/miguelmota/audiobuffer-slice/blob/master/audiobuffer-slice.js
    function slice (buffer, begin, end) {
        var channels = buffer.numberOfChannels;
        var rate = buffer.sampleRate;

        var startOffset = rate * begin;
        var endOffset = rate * end;
        var frameCount = endOffset - startOffset;
        var newArrayBuffer;

        try {
            newArrayBuffer = wavesurfer.backend.ac.createBuffer(channels, endOffset - startOffset, rate);
            var anotherArray = new Float32Array(frameCount);
            var offset = 0;

            for (var channel = 0; channel < channels; channel++) {
                buffer.copyFromChannel(anotherArray, channel, startOffset);
                newArrayBuffer.copyToChannel(anotherArray, channel, offset);
            }
        } catch(e) {
            console.log(e);
            error = e;
        }

        return newArrayBuffer;
    }

    // concatenate two audio buffers
    function concatenateAudioBuffers(buffer1, buffer2) {
        if (!buffer1 || !buffer2) {
            console.log("no buffers!");
            return null;
        }

        if (buffer1.numberOfChannels != buffer2.numberOfChannels) {
            console.log(buffer1.numberOfChannels);
            console.log(buffer2.numberOfChannels);
            console.log("number of channels is not the same!");
            return null;
        }

        if (buffer1.sampleRate != buffer2.sampleRate) {
            console.log("sample rates don't match!");
            return null;
        }

        var tmp = wavesurfer.backend.ac.createBuffer(buffer1.numberOfChannels, buffer1.length + buffer2.length, buffer1.sampleRate);

        for (var i=0; i<tmp.numberOfChannels; i++) {
            var data = tmp.getChannelData(i);
            data.set(buffer1.getChannelData(i));
            data.set(buffer2.getChannelData(i),buffer1.length);
        }
        return tmp;
    }

    // Convert an AudioBuffer to a Blob using WAVE representation
    // https://www.russellgood.com/how-to-convert-audiobuffer-to-audio-file/
    function bufferToWave(abuffer, len) {
        var numOfChan = abuffer.numberOfChannels,
            length = len * numOfChan * 2 + 44,
            buffer = new ArrayBuffer(length),
            view = new DataView(buffer),
            channels = [], i, sample,
            offset = 0,
            pos = 0;
    
        // write WAVE header
        setUint32(0x46464952);                         // "RIFF"
        setUint32(length - 8);                         // file length - 8
        setUint32(0x45564157);                         // "WAVE"
    
        setUint32(0x20746d66);                         // "fmt " chunk
        setUint32(16);                                 // length = 16
        setUint16(1);                                  // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2);                      // block-align
        setUint16(16);                                 // 16-bit (hardcoded in this demo)
    
        setUint32(0x61746164);                         // "data" - chunk
        setUint32(length - pos - 4);                   // chunk length
    
        // write interleaved data
        for(i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));
    
        while(pos < length) {
        for(i = 0; i < numOfChan; i++) {             // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true);          // write 16-bit sample
            pos += 2;
        }
        offset++                                     // next source sample
        }
    
        // create Blob
        return new Blob([buffer], {type: "audio/wav"});
    
        function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
        }
    
        function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
        }
    }

    function secondsToTimestamp(seconds) {
        seconds = Math.floor(seconds);
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds - (h * 3600)) / 60);
        var s = seconds - (h * 3600) - (m * 60);
      
        h = h < 10 ? '0' + h : h;
        m = m < 10 ? '0' + m : m;
        s = s < 10 ? '0' + s : s;
        return h + ':' + m + ':' + s;
    }

    function getZoomLevel() {
        const wsParams = wavesurfer.params;
        var width =
        wsParams.fillParent && !wsParams.scrollParent
            ? wavesurfer.drawer.getWidth()
            : wavesurfer.drawer.wrapper.scrollWidth * wsParams.pixelRatio;
        var duration = wavesurfer.getDuration();
        var pixelsPerSecond = width / duration
        return pixelsPerSecond;
    }
});
