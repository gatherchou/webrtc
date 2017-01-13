var fs = require('fs');
var express = require('express');
var path = require('path');
var app = express();
var https = require('https');

var privateKey  = fs.readFileSync('./server.key', 'utf8');
var certificate = fs.readFileSync('./server.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};

var server = https.createServer(credentials, app);
var io = require('socket.io')(server);

var mongoose = require('mongoose');
var db = mongoose.connect('mongodb://localhost/WebRTC');
var userModel = require('./model/model.js');

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('port', 3000);

var Port = app.get('port');

app.get('/', function(req, res){
	res.render('index');
});

app.get('/history', function(req, res){

    userModel.find({}, function(err, docs){
        res.render('history', {msgs: docs});
    });
})

var userLists = {};

io.on('connection', function(socket){
	// when the client emits 'add user', this listens and executes
	socket.on('add user', function (username) {
    	// we store the username in the socket session for this client
    	socket.username = username;
    	if (!userLists[username]) {
    		userLists[username] = username;
    	}
    	// echo globally (all clients) that a person has connected
    	io.emit('flash userLists', userLists);
    });

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (data) {
    	// we tell the client to execute 'new message'
        var new_msg = new userModel({
            name: socket.username,
            msg: data
        })

        new_msg.save(function(err){
            if (err) {console.log(err);}
        });

    	socket.broadcast.emit('new message', {
    		username: socket.username,
    		message: data
    	});
    });

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
    	if (userLists[socket.username]) {
    		delete userLists[socket.username]
    	}

    	socket.broadcast.emit('flash userLists', userLists);

    	emitMessage('user disconnected', {id: socket.id});

    	var roomname = getRoomname();

    	if (roomname) {
    		socket.leave(roomname);
    	}
    });

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

    function checkUser(username) {
    	for (x in userLists){
    		if (userLists[x] == username) {
    			return x;
    		}
    	}
    }
});

server.listen(Port, function(){
	console.log('listening on localhost:' + Port);
});