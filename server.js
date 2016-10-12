var fs = require('fs');
var http = require('http');
var https = require('https');
var privateKey  = fs.readFileSync('./server.key', 'utf8');
var certificate = fs.readFileSync('./server.crt', 'utf8');

var credentials = {key: privateKey, cert: certificate};
var express = require('express');
var app = express();

// your express configuration here

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

app.get('/', function(req, res){
	res.sendfile('static/index.html');
})

httpServer.listen(8080);
httpsServer.listen(8443);