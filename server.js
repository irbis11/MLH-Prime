var express = require('express');
var app = express();
var http = require('http').Server(app);
var fs = require('fs');
var io = require('socket.io')(http);
var tracks = [];
var rooms = [];
var roomInfo = new Map(); // Room name -> Room object
var clientRooms = new Map(); // Socket -> Room name

readDir();

app.use(express.static('.'));

svr = http.listen(7777, function(){
    console.log('Listening on port 7777');
});

process.on('exit', function () {
  console.log('About to exit, waiting for remaining connections to complete');
  svr.close();
});

process.on('SIGTERM', function () {
  console.log('About to exit, waiting for remaining connections to complete');
  svr.close();
});

process.on('uncaughtException', function () {
  console.log('About to exit, waiting for remaining connections to complete');
  svr.close();
});

io.on('connection', function(socket){
    console.log('Client connected');

    socket.on('disconnect', function(){
        console.log('Client disconnected');
        var roomName = clientRooms.get(socket);
        if (roomName != undefined) {
            // Client was in a room, remove it from it
            removeFromRoom(roomName, socket);
            var room = roomInfo.get(roomName);
            for(var index = 0; index < room.clients.length; index++) {
                room.clients[index].emit('COUNT', room.clients.length);
            }
        }
    });

    socket.on('JOIN ROOM', function(name) {
        if (!rooms.includes(name)) {
            createRoom(name);
        }
        addToRoom(name, socket);
        sendRoomInfo(name, socket);

        var room = roomInfo.get(name);
        for(var index = 0; index < room.clients.length; index++) {
            room.clients[index].emit('COUNT', room.clients.length);
        }
    });


    //song is JSON {id,startPoint}
    socket.on('PLAY', function(song) {
        var roomName = clientRooms.get(socket);
        if (roomName == undefined) {
            return;
        }
        var room = roomInfo.get(roomName);
        var array;
        if (room.songs[song].type == "NOTES") {
            array = notesSplit(room.songs[song].notes, room.clients.length);

            //TODO cut down array to remaing notes
        }
        var songInfo = {};
        songInfo.song = song;

        //if resuming from pause 
        if(room.isPaused) {
            
            songInfo.startPoint = room.startPoint;
        } else {
            songInfo.startPoint = 0;
            room.startPoint = 0;
        }
        
        //update where we are at 
        room.currentSong = song;
        room.startTime = songInfo.startTime = +new Date();
        room.isPaused = false;
        
        for (var i = 0; i < room.clients.length; i++) {
            if (room.songs[song].type == "NOTES") {
                songInfo.clientNotes = array[i];
            }
            room.clients[i].emit('PLAY', songInfo);
        }
    });

    socket.on('STOP', function() {
        var roomName = clientRooms.get(socket);
        var room = roomInfo.get(roomName);
        room.isPaused = false;

        for (var i = 0; i < room.clients.length; i++) {
            room.clients[i].emit('STOP', "");
        }
    });

    socket.on('PAUSE', function(time) {
        var roomName = clientRooms.get(socket);
        var room = roomInfo.get(roomName);
        room.isPaused = true;
        room.startPoint = time;
        for (var i = 0; i < room.clients.length; i++) {
            room.clients[i].emit('PAUSE', "");
        }
    });

    socket.on('KEYBOARD', function(type) {
        var roomName = clientRooms.get(socket);
        var room = roomInfo.get(roomName);
        for (var i = 0; i < room.clients.length; i++) {
            room.clients[i].emit('KEYBOARD', type);
        }
    });

});

function sendRoomInfo(roomName, client) {
    var room = roomInfo.get(roomName);
    var info = {};
    info.name = room.name;
    info.songs = room.songs;
    info.currentSong = room.currentSong;
    info.startTime = room.startTime;
    info.startPoint = room.startPoint;
    info.isPaused = room.isPaused;
    info.time = +new Date();

    client.emit('ROOM INFO', JSON.stringify(info))
}

function addToRoom(roomName, client) {
    var room = roomInfo.get(roomName);
    var index = room.clients.indexOf(client);
    if (index == -1) {
        // Associate the client with the room
        clientRooms.set(client, roomName);
        room.clients.push(client); // Add to room
        roomInfo.set(roomName, room); // Update the room object noteMap
    }
}

function removeFromRoom(roomName, client) {
    clientRooms.set(client, undefined); // Remove association
    var room = roomInfo.get(roomName);
    var index = room.clients.indexOf(client);
    room.clients.splice(index, 1); // Remove from room
    roomInfo.set(roomName, room); // Update the room object noteMap
}

function getSongs() {
    var songs = [];
    var song = {};
    song.name = "Imperial March";
    song.type = "NOTES";
    song.notes = marchSong;
    songs.push(song);
    song = {};
    song.name = "Tetris Song";
    song.type = "NOTES";
    song.notes = tetrisSong;
    songs.push(song);
    song = {};
    song.name = "Ode to Joy";
    song.type = "NOTES";
    song.notes = odeToJoy;
    songs.push(song);
    song = {};
    song.name = "Empty Song";
    song.type = "NOTES";
    song.notes = [];
    songs.push(song);


    
    console.log(tracks);
    for(var index = 0; index < tracks.length; index++) {
        song = {};
        song.name = tracks[index];
        song.type = "mp3";
        song.notes = [];
        songs.push(song);
    }
    
    return songs;
}

function createRoom(name) {
    rooms.push(name);
    console.log("Created room: " + name);
    var room = {};
    room.name = name;
    room.clients = [];
    room.currentSong = null;
    room.startTime = null;
    room.startPoint = 0;
    room.isPaused = false;
    room.songs = getSongs();
    roomInfo.set(name, room);
}

console.log("Server running...");

function lastNoteEndTime(array) {
    return array[array.length - 1].time + array[array.length - 1].length;
}

function addNote(array, length, type, time) {
    var note = {};
    note.type = type;
    note.time = time;
    note.length = length;
    array.push(note);
}

// Array contains
if (![].includes) {
    Array.prototype.includes = function(searchElement /*, fromIndex*/ ) {
        'use strict';
        var O = Object(this);
        var len = parseInt(O.length) || 0;
        if (len === 0) {
            return false;
        }
        var n = parseInt(arguments[1]) || 0;
        var k;
        if (n >= 0) {
            k = n;
        } else {
            k = len + n;
            if (k < 0) {k = 0;}
        }
        var currentElement;
        while (k < len) {
            currentElement = O[k];
            if (searchElement === currentElement ||
                (searchElement !== searchElement && currentElement !== currentElement)) {
                return true;
            }
            k++;
        }
        return false;
    };
}

function readDir()
{
    const dir = './tracks/';
    const fs = require('fs');
    
    fs.readdir(dir, (err, files) => { files.forEach(file => { tracks.push(file.replace(".mp3", ""))}); });
    
}

// Tetris
var tetrisSong = [];
var mod = 1.5;
addNote(tetrisSong, 150 * mod, "E4", 0 * mod);
addNote(tetrisSong, 159 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E5", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "D5", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E5", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C5", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "A4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "G4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "G4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "A4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "G4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "E4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "D4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "D#4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 159 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E5", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "D5", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E5", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C5", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "A4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "G4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "G4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "A4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "G4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "E4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "D4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "D#4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);

addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 159 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E5", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "D5", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E5", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C5", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "A4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "G4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "G4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "A4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "G4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "E4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "D4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "D#4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 159 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E5", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "D5", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E5", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C5", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "A4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "G4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "G4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "A4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "G4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "E4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "D4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "D#4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 100 * mod, "B4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "C4", lastNoteEndTime(tetrisSong) + 0 * mod);
addNote(tetrisSong, 150 * mod, "F#4", lastNoteEndTime(tetrisSong) + 40 * mod);
addNote(tetrisSong, 150 * mod, "E4", lastNoteEndTime(tetrisSong) + 40 * mod);

// Ode to joy
var odeToJoy = [];
var mod1 = 0.9;
addNote(odeToJoy, 500 * mod1, "B4", 0);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);

addNote(odeToJoy, 500 * mod1, "C5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "D5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "D5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "C5", lastNoteEndTime(odeToJoy) + 40 * mod1);

addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 250 * mod1, "A4", lastNoteEndTime(odeToJoy) + 290 * mod1);
addNote(odeToJoy, 1000 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);

addNote(odeToJoy, 500 * mod1, "C5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "D5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "D5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "C5", lastNoteEndTime(odeToJoy) + 40 * mod1);

addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 250 * mod1, "G4", lastNoteEndTime(odeToJoy) + 290 * mod1);
addNote(odeToJoy, 1000 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 250 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 250 * mod1, "C5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 250 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 250 * mod1, "C5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 1000 * mod1, "D4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);

addNote(odeToJoy, 500 * mod1, "C5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "D5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "D5", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "C5", lastNoteEndTime(odeToJoy) + 40 * mod1);

addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "B4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 500 * mod1, "A4", lastNoteEndTime(odeToJoy) + 40 * mod1);
addNote(odeToJoy, 250 * mod1, "G4", lastNoteEndTime(odeToJoy) + 290 * mod1);
addNote(odeToJoy, 1000 * mod1, "G4", lastNoteEndTime(odeToJoy) + 40 * mod1);

// Imperial March
var marchSong = [];
addNote(marchSong, 350, "G4", 0);
addNote(marchSong, 350, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "D#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "D#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 700, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "D5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "D5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "D5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "D#5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "F#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "D#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 700, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "G5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "G5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "F#5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "F5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "E5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "D#5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 50, "E5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "G#4", lastNoteEndTime(marchSong) + 400);
addNote(marchSong, 350, "C#5", lastNoteEndTime(marchSong) + 200);
addNote(marchSong, 250, "C5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "B4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 50, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "D#4", lastNoteEndTime(marchSong) + 400);
addNote(marchSong, 350, "F#4", lastNoteEndTime(marchSong) + 200);
addNote(marchSong, 250, "D#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 700, "D5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "G5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 350, "G5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "F#5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "F5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "E5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "D#5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 50, "E5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "G#4", lastNoteEndTime(marchSong) + 400);
addNote(marchSong, 350, "C#5", lastNoteEndTime(marchSong) + 200);
addNote(marchSong, 250, "C5", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "B4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 50, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "D#4", lastNoteEndTime(marchSong) + 400);
addNote(marchSong, 350, "G4", lastNoteEndTime(marchSong) + 200);
addNote(marchSong, 250, "D#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 25, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 300, "G4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 250, "D#4", lastNoteEndTime(marchSong) + 150);
addNote(marchSong, 25, "A#4", lastNoteEndTime(marchSong) + 100);
addNote(marchSong, 700, "G4", lastNoteEndTime(marchSong) + 100);



function notesSplit(notes, clientsNumber) {
    var notesArray = initializeZerosArray(notes, clientsNumber);
    var previousNote = 0;

    for (var i = 0; i < notes.length; i++) {
        if (notes[i].type != previousNote) {
            var randomHalfArray = randomHalfClients(clientsNumber);
        } else {}

        for (var j = 0; j < randomHalfArray.length; j++) {
            notesArray[randomHalfArray[j]][i] = 1;
        }
        previousNote = notes[i].type;
    }

    return notesArray;
}

function print(x) {
    console.log(x);
}

function initializeZerosArray(notes, clientsNumber) {
    var array = createArray(clientsNumber, notes.length);

    for (var i = 0; i < clientsNumber; i++) {
        for (var j = 0; j < notes.length; j++)
            array[i][j] = 0;
    }

    return array;
}

function randomHalfClients(clientsNumber) {
    var amount = Math.round(clientsNumber/2);
    var unique_random_numbers = [];

    while (unique_random_numbers.length < amount) {
        var random_number = Math.floor(Math.random()*(clientsNumber));
        if (unique_random_numbers.indexOf(random_number) == -1) {
            unique_random_numbers.push(random_number);
        }
    }

    return unique_random_numbers;
}

function createArray(length) {
    var arr = new Array(length || 0);
    var i = length;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length-1 - i] = createArray.apply(this, args);
    }

    return arr;
}