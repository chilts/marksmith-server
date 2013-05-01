// ----------------------------------------------------------------------------
//
// app.js - Marksmith's main server application.
//
// Copyright 2013 Andrew Chilton <andychilton@gmail.com>
//
// ----------------------------------------------------------------------------

// core
var http = require('http');

// npm
var argh = require('argh');
var express = require('express');

// local
var marksmith = require('./lib/marksmith.js');

// ----------------------------------------------------------------------------
// some setup

var args = argh.argv;

// incoming args: $ node app.js <directory> <port>
var siteDir = args.dir.replace(/\/$/, '');
var port    = args.port;

// generate the other paths we need
var staticDir  = siteDir + '/public';
var viewsDir   = siteDir + '/views';
var contentDir = siteDir + '/content';

console.log('Using site    = ' + siteDir);
console.log('Using static  = ' + staticDir);
console.log('Using views   = ' + viewsDir);
console.log('Using content = ' + contentDir);

// ----------------------------------------------------------------------------

// load up the marksmith info
marksmith(contentDir, function(err, pages) {
    if (err) throw err;
    console.log(pages);

    // express
    var app = express();

    // some app settings
    app.set('views', __dirname + '/' + viewsDir);
    app.set('view engine', 'jade');

    // see if this is a page we know about
    app.use(function(req, res, next) {
        console.log('url=' + req.path);
        if ( pages[req.path] ) {
            var page = pages[req.path];
            if ( page.meta.type === 'post' ) {
                return res.render('post', { meta : page.meta, content : page.content });
            }
            if ( page.meta.type === 'page' ) {
                return res.render('page', { meta : page.meta, content : page.content });
            }
            if ( page.meta.type === 'index' ) {
                return res.render('index', { meta : page.meta, content : page.content });
            }
        }
        next();
    });

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

    app.use(app.router);

    // start the server
    var server = http.createServer(app);
    server.listen(port, function() {
        console.log('Server listening on port ' + port);
    });

});

// ----------------------------------------------------------------------------
