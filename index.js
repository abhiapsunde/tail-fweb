#!/usr/bin/env node
const commandLineArgs = require('command-line-args')
const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require("socket.io");
const Tail = require('nodejs-tail');
const morgan = require('morgan');
const lineReader = require('line-reader');
const { on } = require('events');

const optionDefinitions = [
    { name: 'daemon', alias: 'd', type: Boolean ,defaultOption: false},
    { name: 'filename', alias :'f' ,type: String, multiple: false, defaultOption: false },
    { name: 'port', alias: 'p', type: Number }
  ]
const options = commandLineArgs(optionDefinitions)
const logFileName = options.filename;
const port = undefined == options.port ? 3000 : options.port ;

console.log("I ran..."+JSON.stringify(options));


const app = express();
const server = http.createServer(app);
const io = new Server(server,{ path: '/tail-f/ws' });
//app.use(errorhandler({ dumpExceptions: true, showStack: true }));
const tail = new Tail(logFileName);

// logging
process.on('uncaughtException', function (err) {
    console.log('eew :' + err.stack);
});


app.use(morgan('combined'));

//End  loggin

//File tail 
tail.on('line', (line) => {
   // process.stdout.write(line);

    io.emit('chat message', line);
})

tail.on('close', () => {
    console.log('watching stopped');
})

tail.watch();
//End file tail

app.get('/tail-f', (req, res) => {
    res.sendFile(__dirname + '/index.html');
    
});
//Web socket
io.on('connection', (socket) => {
    var user = socket.handshake.headers["cf-access-authenticated-user-email"];

    
    lineReader.eachLine(logFileName, function (line, last) {
        socket.emit('chat message', line);;
    });

    socket.on('disconnect', (obj) => {
        console.log('user disconnected : '+ obj);
    });

});
//End Websocket

// END REST
server.listen(port, () => {
    console.log('listening on * : ' + port);
  
});