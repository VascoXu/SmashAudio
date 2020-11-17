document.addEventListener("DOMContentLoaded", function() {
    
    var deleteAudios = [];
    var first = true;
    var first2 = true;
    var zoomLevel = 0;
    var fileSelection = 0;
    var history = [];
    var edits = [];
    var wavesurfers = [];
    var size = 0;
    var selected = 0;

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

    // Create waveform with Wavesurfer.js
    var wavesurfer2 = WaveSurfer.create({
        container: document.querySelector('#waveform2'),
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
                container: '#wave-timeline2',
            })
        ]
    });

    // Wavesurfer1 is selected
    wavesurfer.on('interaction', function() {
        highlightWS1();
    });

    // Wavesurfer2 is selected
    wavesurfer2.on('interaction', function() {
        highlightWS2();
    });

    // Insert wavesurfer to an array for later use
    wavesurfers.push(wavesurfer);
    wavesurfers.push(wavesurfer2);

    // Replace selected region with "delete"
    document.getElementById("replace").addEventListener("click", function() {
        var regions = wavesurfers[selected].regions.list;
        var keys = Object.keys(regions);

        if (keys.length > 0) {
            var start = regions[keys[0]].start;
            var end = regions[keys[0]].end;
            
            if (selected == 0) edits.push([start, end]);

            var part1 = slice(wavesurfers[selected].backend.buffer, 0, start); 
            var middle = createDeleteAudio(start, end, selected);
            var part2 = slice(wavesurfers[selected].backend.buffer, end, wavesurfers[selected].getDuration());
            
            var concat = concatenateAudioBuffers(part1, middle);
            concat  = concatenateAudioBuffers(concat, part2);
            
            history[selected].push([concat]);

            wavesurfers[selected].loadDecodedBuffer(concat);
        }
    });

    // Replace entire audio with saved edits
    document.getElementById("prev").addEventListener("click", function() {
        // Replace
        var buffer = wavesurfer2.backend.buffer;
        if (buffer) {
            for (let i = 0; i < edits.length; i++) {
                var edit = edits[i];
                var start = edit[0];
                var end = edit[1];
    
                var part1 = slice(buffer, 0, start); 
                var middle = createDeleteAudio(start, end, 1);
                var part2 = slice(buffer, end, wavesurfer2.getDuration());
                
                buffer = concatenateAudioBuffers(part1, middle);
                buffer = concatenateAudioBuffers(buffer, part2);
            }
            history[1].push(buffer);
            wavesurfer2.loadDecodedBuffer(buffer);
        }
        else {
            alert("Second audio was not found!");
        }
    });

    // Cut the track
    document.getElementById("cut").addEventListener("click", function() {
        var buffer = wavesurfers[selected].backend.buffer;
        var regions = wavesurfers[selected].regions.list;
        var keys = Object.keys(regions);

        if (keys.length > 0) {
            var start = regions[keys[0]].start;
            var end = regions[keys[0]].end;
            
            // Handle negative numbers
            if (start < 0) start = 0;

            //Cut
            if (start == 0) {
                buffer = slice(buffer, end, wavesurfers[selected].getDuration());
            }
            else {
                var part1 = slice(buffer, 0, start);
                var part2 = slice(buffer, end, wavesurfers[selected].getDuration());
                buffer = concatenateAudioBuffers(part1, part2);
            }
        }
        history[selected].push(buffer);
        wavesurfers[selected].loadDecodedBuffer(buffer);
    });

    // Sync audio
    document.getElementById("sync").addEventListener("click", function() {
        // Package the data
        if (wavesurfer.backend.buffer && wavesurfer2.backend.buffer) {
            const blob1 = bufferToWave(wavesurfer.backend.buffer, wavesurfer.backend.buffer.length);
            const blob2 = bufferToWave(wavesurfer2.backend.buffer, wavesurfer2.backend.buffer.length);
            var fd = new FormData();
            fd.append("audio1", blob1);
            fd.append("audio2", blob2);
    
            // Send audio blob to server
            $('#loading').show();
            fetch('/api/peaks', {
                method: 'POST',
                body: fd,
            })
            .then(response => response.json())
            .then(result => {
                $('#loading').hide();
    
                // Retrieve sync point
                var sync_points = result;
                
                // Slice first buffer according to sync point
                var buffer = wavesurfer.backend.buffer;
                var duration = wavesurfer.backend.buffer.duration;
                buffer = slice(buffer, sync_points['sync_point1'] + sync_points['sync_length1'], duration);
    
                history[0].push(buffer);
                wavesurfer.loadDecodedBuffer(buffer);  
    
                // Slice second buffer according to sync point
                buffer = wavesurfer2.backend.buffer;
                duration = wavesurfer2.backend.buffer.duration;
                buffer = slice(buffer, sync_points['sync_point2'] + sync_points['sync_length2'], duration);
                
                history[1].push(buffer);
                wavesurfer2.loadDecodedBuffer(buffer);
            });
        }
        else {
            alert("Two audio files required for syncing");
        }
    }); 

    // Revert changes
    document.getElementById("revert").addEventListener("click", function() {
        if (history[selected].length > 1) {
            var revert = history[selected].pop();
            var prev = history[selected][history[selected].length - 1];
            // Check if reverted change is a replace action 
            if (Array.isArray(revert) && selected == 0) {
                // Update the edits array accordingdly 
                edits.pop();
            }
            if (Array.isArray(prev)) prev = prev[0];
            if (prev) wavesurfers[selected].loadDecodedBuffer(prev);
        }
    }); 

    // Action listener for play button
    document.getElementById("play").addEventListener("click", function() {
        var regions = wavesurfers[selected].regions.list;
        var keys = Object.keys(regions);
        if (keys.length >= 1) {
            var start = regions[keys[0]].start;
            var end = regions[keys[0]].end;
            wavesurfers[selected].play(start, end);  
        }
        else {
            wavesurfers[selected].playPause();
        }
    });

    // Action listener for playing 1x speed
    document.getElementById("play-1x").addEventListener("click", function() {
        wavesurfers[selected].setPlaybackRate(1);
    });

    // Action listener for playing 2x speed 
    document.getElementById("play-2x").addEventListener("click", function() {
        wavesurfers[selected].setPlaybackRate(1.45);
    });
    
    // Action listener for pause button
    document.getElementById("pause").addEventListener("click", function() {
        wavesurfers[selected].playPause();
    });

    // Action listener for pause button
    document.getElementById("fast-backward").addEventListener("click", function() {
        var currentTime = wavesurfers[selected].getCurrentTime();
        if (currentTime - 5 > 0) {
            wavesurfers[selected].setCurrentTime(currentTime - 5);
        }
        else {
            wavesurfers[selected].setCurrentTime(0);
        }
    });
        
    // Action listener for pause button
    document.getElementById("fast-forward").addEventListener("click", function(){
        var currentTime = wavesurfers[selected].getCurrentTime();
        var duration = wavesurfers[selected].getDuration();
        
        if (currentTime + 5 < duration) {
            wavesurfers[selected].setCurrentTime(currentTime + 5);
        }
        else {
            wavesurfers[selected].setCurrentTime(duration);
        }
    });

    // Action listener for overall zoom
    var slider = document.querySelector('[data-action="zoom"]');

    slider.value = wavesurfer.params.minPxPerSec;
    slider.min = wavesurfer.params.minPxPerSec;
    // Allow extreme zoom-in, to see individual samples
    slider.max = 200;

    slider.addEventListener('input', function() {
        wavesurfers[selected].zoom(Number(this.value));
    });

    // Set initial zoom to match slider value
    wavesurfer.zoom(slider.value);

    // Action listener for zoom-in
    // document.getElementById("zoom-in").addEventListener("click", function() {
    //     if (wavesurfers[selected].backend.buffer && zoomLevel < 100) {
    //         zoomLevel += 1;
    //         wavesurfers[selected].zoom(zoomLevel);
    //     }
    // });

    // // Action listener for zoom-out
    // document.getElementById("zoom-out").addEventListener("click", function() {
    //     if (wavesurfers[selected].backend.buffer && zoomLevel > 0) {
    //         zoomLevel -= 1;
    //         wavesurfers[selected].zoom(zoomLevel);
    //     }
    // });

    // Action listener for download button
    document.getElementById("download").addEventListener("click", function() {
        for (let i = 0; i < size; i++) {
            if (wavesurfers[i].backend.buffer) {
                var buffer = wavesurfers[i].backend.buffer;
                var length = wavesurfers[i].backend.buffer.length;
                
                var filename = prompt("Please enter a filename for first audio: "); 
                if (filename == null || filename == "") {
                    alert("Invalid filename!");
                  } else {
                    var download_link = document.getElementById("download-link");
                    download_link.href = URL.createObjectURL(bufferToWave(buffer, length));
                    download_link.download = `${filename}.wav`;
                    download_link.click();
                    if (i == 1) download_link.remove();
                  }
            }
        }
    });

    // Handle choose file and loading thereof
    document.getElementById("choose-file").addEventListener('change', function(e) {
        var files = [...this.files].sort();
    
        // Merge audio files
        if (files.length > 0) {
            // Display loading until loaded
            $('#loading').show();
            mergeAudio(files).then(result => {    
                // Reset first
                if (!first2) {
                    first = true;
                    first2 = true;
                }
                
                if (fileSelection == 0) {
                    // Load the AudioBuffer into Wavesurfer
                    wavesurfer.loadDecodedBuffer(result);
                }
                else {
                    // Load the AudioBuffer into Wavesurfer
                    wavesurfer2.loadDecodedBuffer(result);
                }
                
                // Increment file number
                fileSelection += 1;
                fileSelection %= 2;
            })
        }
    }, false);

    // Allow selection of the same file
    document.getElementById("choose-file").addEventListener("click", function() {
        this.value = null;
    });

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
            history.push([])
            history[0].push(wavesurfer.backend.buffer);
            first = !first;

            size+=1;
            size%=3;
        }

        // Determine source of delete audio
        var numChannels = wavesurfer.backend.buffer.numberOfChannels;
        var deleteSrc = `static/media/delete${numChannels}.wav`;

        fetch(deleteSrc)
        .then(response => response.arrayBuffer())
        .then(data => {
            wavesurfer.backend.ac.decodeAudioData(data).then(decodedData => {
                deleteAudios[0] = decodedData;
            });
        });

    });

    // Runs when Wavesurfer.js is ready
    wavesurfer2.on('ready', function() {
        // Hide loading bar
        $('#loading').hide();

        // Insert buffer into history
        if (first2) {
            // Get current zoom level
            zoomLevel = getZoomLevel();

            // Save first history
            history.push([]);
            history[1].push(wavesurfers[1].backend.buffer);
            first2 = !first2;

            size+=1;
            size%=3;
        }

        // Determine source of delete audio
        var numChannels = wavesurfer2.backend.buffer.numberOfChannels;
        var deleteSrc = `static/media/delete${numChannels}.wav`;

        fetch(deleteSrc)
        .then(response => response.arrayBuffer())
        .then(data => {
            wavesurfer2.backend.ac.decodeAudioData(data).then(decodedData => {
                deleteAudios[1] = decodedData;
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

    // Runs when audio is playing (used to display time)
    wavesurfer2.on("audioprocess", function() {
        if(wavesurfer2.isPlaying()) {
            // Display current time 
            var seconds = wavesurfer2.getCurrentTime();
            var formattedTime = secondsToTimestamp(seconds);
            document.getElementById("current-time").innerText = formattedTime;
        }
    });

    // Runs when region is updated (only allow one region)
    wavesurfer.on('region-updated', function(region) {
        highlightWS1();
        var regions = region.wavesurfer.regions.list;
        var keys = Object.keys(regions);
        if (keys.length > 1) {
            regions[keys[0]].remove();
        }
    });

    // Runs when region is updated (only allow one region)
    wavesurfer2.on('region-updated', function(region) {
        highlightWS2();
        var regions = region.wavesurfer.regions.list;
        var keys = Object.keys(regions);
        if (keys.length > 1) {
            regions[keys[0]].remove();
        }
    });

    // Runs when region is clicked
    wavesurfer.on('region-click', function(region) {
        highlightWS1();
    });

    // Runs when region is clicked
    wavesurfer2.on('region-click', function(region) {
        highlightWS2();
    });

    // Runs when player is clicked (used to clear regions)
    wavesurfer.drawer.on('click', function (e) {
        highlightWS1();

        // Clear dragged regions on click
        wavesurfer.clearRegions();

        // Display current time 
        var seconds = wavesurfer.getCurrentTime();
        var formattedTime = secondsToTimestamp(seconds);
        document.getElementById("current-time").innerText = formattedTime;
    });

    // Runs when player is clicked (used to clear regions)
    wavesurfer2.drawer.on('click', function (e) {
        highlightWS2();

        // Clear dragged regions on click
        wavesurfer2.clearRegions();

        // Display current time 
        var seconds = wavesurfer2.getCurrentTime();
        var formattedTime = secondsToTimestamp(seconds);
        document.getElementById("current-time").innerText = formattedTime;
    });

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

    function highlightWS1() {
        // Highlight wavesurfer1 using a blue glow
        selected = 0;
        document.getElementById("ws-container2").classList.remove("selected");
        document.getElementById("ws-container").classList.add("selected");
    }

    function highlightWS2() {
        // Highlight wavesurfer2 using a blue glow
        selected = 1;
        document.getElementById("ws-container").classList.remove("selected");
        document.getElementById("ws-container2").classList.add("selected");
    }

    // Create delete sound
    function createDeleteAudio(start, end, selection) {
        var length = (end - start);
        var splices = length / 0.78;
        var deleteSoundclip = deleteAudios[selection];
        for (var i = 0; i < Math.ceil(splices); i++) {
            deleteSoundclip = concatenateAudioBuffers(deleteSoundclip, deleteAudios[selection]);
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
