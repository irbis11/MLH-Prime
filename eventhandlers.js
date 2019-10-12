var socket;
var room;
var paused = false;
var nextNote = null;

var playing = false;
var currentlyPlaying;

var timeCorrection = 0;

var startTime = +new Date();
var startPoint = 0;

var playID = 0;

function pageLoad() {
    initAudio();
    socket = io();

    socket.on('ROOM INFO', function(roomInfo) {
        room = JSON.parse(roomInfo);
        timeCorrection = Date.now() - room.time;
        var select = $('#sel1');
        select.empty();
        for (var i = 0; i < room.songs.length; i++) {
            var option = $('<option></option>').attr("value", i).text(room.songs[i].name);
            select.append(option);
        }
        setInterval(setClock, 10);

        //work out what is playing
        startTime = room.startTime;
        startPoint = room.startPoint;
        if(!room.isPaused && room.currentSong && room.songs[room.currentSong].type == "mp3") {
            //play whatever is playing
            $('#currentSong').html("Now playing: " + room.songs[room.currentSong].name);
            playMp3(room.currentSong,false);
        } else if(!room.isPaused && room.currentSong && room.songs[room.currentSong].type == "NOTES") {
            //$('#currentSong').html("Now playing: " + room.songs[room.currentSong].name);
            //playMp3(room.currentSong,false);
        }

        
        $('.key').click(function(key) {
            var type = $(this).find('.keycap').html();
            socket.emit("KEYBOARD", type);
        });
        
        });

 socket.on('KEYBOARD', function(type) {
        var note = {};
        note.type = type;
        note.length = 200;
        playNote(note);
        flashPianoKey(note.type, note.length);
    });
    

    socket.on('PLAY', function(songInfo) {
        playing = false;//cut off anything currently playing
        var song = songInfo.song;
        console.log(songInfo);
        console.log("Play: " + song);
        startTime = songInfo.startTime;
        startPoint = songInfo.startPoint;
        //console.log(paused+ "   puased" + currentlyPlaying + "  playing");
        //are we paused?
        console.log(songInfo);
        if(startPoint != 0) {
            pasued = false;
            //update ui
            $('#currentSong').html("Now playing: " + room.songs[song].name);

            //sync with server
            

            //work out what type it is

            if(room.songs[song].type == "NOTES") {
                stopMp3();
                if(!paused) {
                    playing = false;//stop current player to avoid duplicate
                playSong(room.songs[song].notes, (+new Date()) + 100);
                }
                
            } else if(room.songs[song].type == "mp3") {
                playMp3(song,true);
            }
        } else {
            console.log("Play: " + song);
            paused = false;
            //$('#player')[0].pause();//stop previous song
            //$('#player')[0].currentTime = 0;
            playing = false;//stops NOTES playing

            //update ui
            $('#currentSong').html("Now playing: " + room.songs[song].name);

            //work out what type it is
            currentlyPlaying = song;

            if(room.songs[song].type == "NOTES") {
                stopMp3();
                playSong(room.songs[song].notes, songInfo.clientNotes, serverTime() + 100);
            } else if(room.songs[song].type == "mp3") {
                playMp3(song,false);
            }

            paused = false;

        }

    });

    socket.on("STOP", function() {
        //stop the music playing
        $('#player')[0].pause();//stop previous song
        $('#player')[0].currentTime = 0;
        playing = false;//stops NOTES playing

        //update now playing display
        $('#currentSong').html("No song playing");
    });

    socket.on("COUNT", function(count) {
        $('#room').html("Users connected: " + count);
    });

    

    socket.on("PAUSE",function(){
        //stop the music where it is
        console.log("paused.....");
        paused = true;
        $('#player')[0].pause();
        playing = false;
        $('#currentSong').html("Song paused");
    });

    addEventHandlers();
}

function addEventHandlers() {
    //add handler for connect button
    $('.connectButton').click(function(){
        //grab room id
        var roomID = $('#roomId').val();
        connectToRoom(roomID);
    });
    
}

function playMp3(song,fromPause,isHotjoin) {//from Pause is boolean whether it is currently pasued
        isHotjoin = isHotjoin || false;

        paused = false;
        var tuneName = room.songs[song].name;
        fullTuneName = "./tracks/" + tuneName + ".mp3";
        fullTuneName = fullTuneName.replace(" ", "%20");
        console.log(tuneName);

        //work out time diff from server
        var diff = +new Date() - startTime;
        var diff = diff / 1000;
        $("#mp3Source").attr("src", fullTuneName).detach().appendTo("#player");
        $('#player')[0].load();
        $('#player')[0].currentTime = diff + startPoint;
        // if(!fromPause) {
        //     $("#mp3Source").attr("src", fullTuneName).detach().appendTo("#player");
        //     $('#player')[0].load();
        //     $('#player')[0].currentTime = diff;
        // } else {
        //     $('#player')[0].currentTime = diff + startPoint;
        // }
        
        $('#player')[0].play();
}

function stopMp3() {
    $('#player')[0].pause();
    $('#player')[0].currentTime = 0;
}

function addMusicHandlers() {
    $('.play-button').click(function(){
        //grab the selected tune
        var tuneName = $('.songList').find(":selected").attr('value');
     
        //update the now playing header
        
        
        //notify server
        //playSong(tuneName);
        socket.emit("PLAY", tuneName);
    });

    $('.stop-button').click(function(){
        //make it stop
        socket.emit("STOP", "");
    });

    //event handler to pause
    $('.pause-button').click(function(){
        //if mp3 get current time at pause
        var theTime = $('#player')[0].currentTime;
        socket.emit("PAUSE",theTime);
    });
}

function redrawClient(roomID) {
    //code to draw the player in the client after connecting to a room
    //grab the client html file and append it
    $.get("./public/templates/client.html", function(data) {
        $('.wrapper').html(data);//move data

        //add room name
        $('#roomTitle').html(roomID);

        //connect to room
        socket.emit('JOIN ROOM', roomID);
        addMusicHandlers();
    });
    
}

//generic handler to connect to a room
function connectToRoom(roomID) {
    //validate to make sure not blank
    if(!roomID || roomID == "") {
        alert("Enter a valid room ID");
    } else {
        //server will then reply with a room
        redrawClient(roomID);
    }
}


function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

function clock(time) {
    var date = new Date(time);
    var h = date.getHours();
    var m = date.getMinutes();
    var s = date.getSeconds();
    if (h < 10) {
        h = "0" + h;
    }
    if (m < 10) {
        m = "0" + m;
    }
    if (s < 10) {
        s = "0" + s;
    }
    return h + ":" + m + ":" + s;
}

function setClock() {
    $('#clock').html(clock(serverTime()));
}

function serverTime() {
    return Date.now() - timeCorrection;
}

function flashBackground(noteType, length, active) {
    $('#center').html(noteType);
    flashPianoKey(noteType, length);
    if (active) {
        $('#center').css('color', '#212121');
    } else {
        $('#center').css('color', '#FFFFFF');
    }
    $('#center').show("scale", null, length / 2);
    setTimeout(function() {
        $('#center').hide("scale", null, length / 2);
    }, length);
}

function flashPianoKey(noteType, length) {
    var keys = $('.key > .keycap');
    for (var i = keys.length - 1; i >= 0; i--) {
        var key = keys[i];
        if (key.innerHTML == noteType) {
            var parent = $(key).parent();
            parent.addClass('highlight');
            setTimeout(function() {
                parent.removeClass('highlight');
            }, Math.min(length, 350));
        }
    }
}

// Map of note symbols to Hz
var noteMap = new Map();
noteMap.set("C4", 261.63);
noteMap.set("C#4", 277.18);
noteMap.set("D4", 293.66);
noteMap.set("D#4", 311.13);
noteMap.set("E4", 329.63);
noteMap.set("F4", 349.23);
noteMap.set("F#4", 369.99);
noteMap.set("G4", 392.00);
noteMap.set("G#4", 415.30);
noteMap.set("A4", 440.00);
noteMap.set("A#4", 466.16);
noteMap.set("B4", 493.88);
noteMap.set("C5", 523.25);
noteMap.set("C#5", 554.37);
noteMap.set("D5", 587.33);
noteMap.set("D#5", 622.25);
noteMap.set("E5", 659.25);
noteMap.set("F5", 698.46);
noteMap.set("F#5", 739.99);
noteMap.set("G5", 783.99);
noteMap.set("G#5", 830.61);
noteMap.set("A5", 880.00);
noteMap.set("A#5", 932.33);
noteMap.set("B5", 987.77);

function playSong(notes, clientNotes, startTime) {
    playID = Math.random();
    var localID = playID + 0;//literal
    
    var start = this.startTime;//use current sync
    
    
    playing = true;
    var nextNote = null;
    var playNextNote = false;
    var targetTime = startTime;
    var timeLeft = 0;
    var timeLoss = +new Date() - start;
    var diff = 0 + timeLoss;
    console.log("here is the diff  " + diff);
    var noteStack = JSON.parse(JSON.stringify(notes));
    var clientNotesStack = JSON.parse(JSON.stringify(clientNotes));
    var thisSong = currentlyPlaying;

    // //var diff = +new Date() - startTime;
    // var clientNotesStack = [];
    // var noteStack = [];
    // console.log(fullNoteStack);
    // for(var index = 0; index < fullNoteStack.length; index++) {
    //     if(fullNoteStack[index].time >= diff) {
    //         noteStack.push(fullNoteStack[index]);
    //         clientNotesStack.push(fullClientNotes[index]);
    //     }
    // }
    //console.log(clientNotesStack);
    setTimeout(function change() {
        if ((!playing && !paused) || currentlyPlaying != thisSong || localID != playID) {
            console.log("yeah we stoppped playing");
            nextNote = null;
            timeLeft = 0;
            return;
        }
        if(!paused) {
            var time = serverTime();
            //$('#time').html(clock(time));
            // Play this note
            if (nextNote != null) {
                flashBackground(nextNote.type, nextNote.length * (3/4), playNextNote);
                if (playNextNote) {
                    playNote(nextNote);
                }
            }
            // Setup next note
            if (noteStack.length > 0) {
                nextNote = noteStack[0];
                playNextNote = clientNotesStack[0];
                targetTime = startTime + nextNote.time;
                noteStack.splice(0, 1); // Remove next note
                clientNotesStack.splice(0, 1); // Remove next note
                timeLeft = targetTime - time;
            } else {
                nextNote = null;
                playNextNote = false;
                return; // No notes left, finished the song
            }
        }
    setTimeout(change, timeLeft);
    }, 0);
}

function playNote(note) {
    var hz = noteMap.get(note.type);
    console.log("Play: " + note.type + ", Hz: " + hz + ", length: " + note.length);
    startTone(hz);
    setTimeout(function() {
        stopTone();
    }, note.length - 10);
}

// Audio generation
var oscillator;
var amp;

// Create an oscillator and an amplifier.
function initAudio() {
    // Use audioContext from webaudio_tools.js
    if (audioContext) {
        oscillator = audioContext.createOscillator();
        fixOscillator(oscillator);
        oscillator.frequency.value = 440;
        amp = audioContext.createGain();
        amp.gain.value = 0;
        oscillator.connect(amp);
        amp.connect(audioContext.destination);
        oscillator.start(0);
    }
}

// Set the frequency of the oscillator and start it running.
function startTone(frequency) {
    var now = audioContext.currentTime;
    oscillator.frequency.setValueAtTime(frequency, now);
    // Ramp up the gain so we can hear the sound.
    // We can ramp smoothly to the desired value.
    // First we should cancel any previous scheduled events that might interfere.
    amp.gain.cancelScheduledValues(now);
    // Anchor beginning of ramp at current value.
    amp.gain.setValueAtTime(amp.gain.value, now);
    amp.gain.linearRampToValueAtTime(1.0, audioContext.currentTime + 0.01);
}

function stopTone() {
    var now = audioContext.currentTime;
    amp.gain.cancelScheduledValues(now);
    amp.gain.setValueAtTime(amp.gain.value, now);
    amp.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + 0.01);
}

document.addEventListener('DOMContentLoaded', pageLoad);
