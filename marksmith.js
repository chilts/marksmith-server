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

    // do all static routes first
    app.use(express.favicon(staticDir + '/favicon.ico'));

    if ( process.env.NODE_ENV === 'production' ) {
        var oneMonth = 30 * 24 * 60 * 60 * 1000;
        app.use(express.static(staticDir), { maxAge : oneMonth });
    }
    else {
        app.use(express.static(staticDir));
    }

    // see if this is a page we know about
    app.use(function(req, res, next) {
        console.log('url=' + req.path);

        var path = req.path;
        if ( path.match(/\/index$/) ) {
            path = path.replace(/\/index$/, '/');
        }

        console.log('path=' + path);

        if ( pages[path] ) {
            var page = pages[path];
            if ( !page.content ) {
                page.content = '';
            }

            // if this is a redirect
            if ( page.meta.type === 'redirect' ) {
                return res.redirect(page.meta.to);
            }

            // content: index and page
            if ( page.meta.type === 'index' ) {
                return res.render('index', page);
            }

            // blog: index and post
            if ( page.meta.type === 'blog' ) {
                return res.render('blog', page);
            }
            if ( page.meta.type === 'post' ) {
                return res.render('post', page);
            }

            // if we have no type so far, just default it to 'page'
            return res.render('page', page);
        }
        next();
    });

    app.use(app.router);

    // start the server
    var server = http.createServer(app);
    server.listen(port, function() {
        console.log('Server listening on port ' + port);
    });

});

// ----------------------------------------------------------------------------
