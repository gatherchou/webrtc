var fs = require('fs');
var https = require('https');
var express = require('express');
var app = express();


var privateKey  = fs.readFileSync('./server.key', 'utf8');
var certificate = fs.readFileSync('./server.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};


var server = https.createServer(credentials, app);

var io = require('socket.io')(server);

app.get('/', function(req, res){
	res.sendfile('static/index.html');
})

io.on('connection', function (socket) {
	// console.log('a user connected');
	// socket.on('disconnect', function () {
	// 	console.log('user disconnected');
	// });
	socket.on('message', function (message) {
		socket.broadcast.emit('message', message);
	});

	socket.on('disconnect', function () {
		socket.broadcast.emit('user disconnected');
	});
});

server.listen(3000);