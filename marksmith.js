// ----------------------------------------------------------------------------
//
// app.js - Marksmith's main server application.
//
// Copyright 2013 Andrew Chilton <andychilton@gmail.com>
//
// ----------------------------------------------------------------------------

var http = require('http');
var express = require('express');
var marked = require('marked');
var argh = require('argh');

// ----------------------------------------------------------------------------
// some setup

var args = argh.argv;

// express
var app = express();

// marked
marked.setOptions({
    gfm        : true,
    tables     : true,
    breaks     : false,
    pedantic   : false,
    sanitize   : true,
    smartLists : true,
    langPrefix : 'language-',
});

// incoming args: $ node app.js <directory> <port>
var baseDir = args.dir.replace(/\/$/, '');
var port    = args.port;

// generate the other paths we need
var staticDir = baseDir + '/public';
var viewsDir  = baseDir + '/views';
var siteDir   = baseDir + '/site';

console.log('Using base   = ' + baseDir);
console.log('Using static = ' + staticDir);
console.log('Using views  = ' + viewsDir);
console.log('Using site   = ' + siteDir);

// ----------------------------------------------------------------------------

// specific routes
app.get('/', function(req, res) {
    res.set('Content-Type', 'text/plain');
    res.send('Hello, World!');
});

// specific routes
app.get('/', function(req, res) {
    res.set('Content-Type', 'text/plain');
    res.send('Hello, World!');
});

app.get('/markdown', function(req, res) {
    marked.setOptions({
        gfm        : true,
        tables     : true,
        breaks     : false,
        pedantic   : false,
        sanitize   : true,
        smartLists : true,
        langPrefix : 'language-',
    });
    var html = marked('I am using __markdown__.');
    res.send(html);
});

app.use(app.router);

// ----------------------------------------------------------------------------

var server = http.createServer(app);
server.listen(port, function() {
    console.log('Server listening on port ' + port);
});

// ----------------------------------------------------------------------------
