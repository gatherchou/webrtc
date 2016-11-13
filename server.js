var fs = require('fs');
var https = require('https');
var express = require('express');
var app = express();
var count = 0;


var privateKey  = fs.readFileSync('./server.key', 'utf8');
var certificate = fs.readFileSync('./server.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};


var server = https.createServer(credentials, app);

var io = require('socket.io')(server);

io.on('connection', function (socket) {

	count++;
	socket.emit('users',{number:count}); 
	socket.broadcast.emit('users', {number:count});


	socket.on('enter', function(roomname){
		socket.join(roomname);
		setRoomname(roomname);
	})

	socket.on('message', function(message){
		message.from = socket.id;

		var target = message.sendto;

		if (target) {
			socket.to(target).emit('message', message);
			return;
		}

		emitMessage('message', message);
	})

	socket.on('disconnect', function(){

		count--;
		socket.broadcast.emit('users',{number:count});

		emitMessage('user disconnected', {id: socket.id});

		var roomname = getRoomname();

		if (roomname) {
			socket.leave(roomname);
		}

	})
	
	function setRoomname(room) {
		socket.roomname = room;
	}

	function emitMessage(type, message) {
		var roomname = getRoomname();

		if (roomname) {
			socket.broadcast.to(roomname).emit(type, message);
		}
		else {
			socket.broadcast.emit(type, message);
		}
	}

	function getRoomname() {
		var room = socket.roomname;
		return room;
	}

});

app.get('/', function(req, res){
	res.sendfile('static/index.html');
});

app.get('/room', function(req, res){
	res.sendfile('static/multi.html');
});

server.listen(3000);