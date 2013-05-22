// ----------------------------------------------------------------------------
//
// app.js - Marksmith's main server application.
//
// Copyright 2013 Andrew Chilton <andychilton@gmail.com>
//
// ----------------------------------------------------------------------------

// core
var http = require('http');
var fs = require('fs');
var url = require('url');

// npm
var log2 = require('log2');
var iniparser = require('iniparser');
var async = require('async');
var send = require('send');

// local
var marksmith = require('./lib/marksmith.js');

// ----------------------------------------------------------------------------
// some setup

var cfgFile = '/etc/marksmith.ini';
var cfgDir = '/etc/marksmith.d';

var cfg     = iniparser.parseSync(cfgFile);
var port    = cfg.port;
var oneMonth = 30 * 24 * 60 * 60 * 1000;
var logfile = cfg.logfile;
var stream  = logfile === 'stdout' ? process.stdout : fs.createWriteStream(logfile);
var log     = log2({ stream : stream });
log('Started');

// ----------------------------------------------------------------------------

// find all the files in /etc/proximity.d/
var files = fs.readdirSync(cfgDir);

var site = {};

async.forEachSeries(
    files,
    readSiteFiles,
    startServer
);

function readSiteFiles(filename, done) {
    log('Reading ' + cfgDir + '/' + filename);

    // read the site info from the config file
    var config = iniparser.parseSync(cfgDir + '/' + filename);

    // now, load up the marksmith info for this site
    marksmith(config.content, function(err, pages) {
        if (err) throw err;
        // console.log(pages);

        // store these pages into this config
        config.pages = pages;

        // all done, store this entire site into the main config
        log('Hostnames=' + config.hostnames);
        config.hostnames.split(',').forEach(function(hostname) {
            log('Hostname=' + hostname);
            site[hostname] = config;
        });

        // ToDo: read all the Jade templates and compile them
        // ...

        done();
    });
}

function startServer(err) {
    var total = Object.keys(site).length;
    log('Read ' + total + ' sites');

    // create the server
    var server = http.createServer();
    server.on('request', function(req, res) {
        var path = url.parse(req.url).pathname;

        // firstly, get the host
        var host = req.headers.host;
        log('Got a request for ' + host);

        // see if we are meant to serve this host
        // console.log(site);
        if ( !site[host] ) {
            // 404
            log('Unknown host ' + host);
            res.statusCode = 404;
            return res.end('404 - Not Found\r\n');
        }

        // ok, we're meant to serve this site
        var thisSite = site[host];

        // ok, we're going to try one of the following things
        // 1) a content route
        // 2) a static file
        serveContent(req, res, thisSite, path, function(err, done) {
            if ( done ) {
                return;
            }

            // if this isn't content, then it might be a static file
            serveStatic(req, res, thisSite, path, function(err, done) {
                if ( done ) {
                    log('A static file was served');
                }
                else {
                    log('Not Found');
                }
            });
        });
    });

    server.listen(port, function() {
        console.log('Server listening on port ' + port);
    });
}

// if we call cb(err, true) then we have dealt with the request
function serveContent(req, res, site, path, cb) {
    //
    var pages = site.pages;

    if ( !pages[path] ) {
        // 404
        log('Unknown path ' + path);
        res.statusCode = 404;
        return res.end('404 - Not Found\r\n');
        return cb();
    }

    var page = pages[path];
    if ( !page.content ) {
        page.content = '';
    }

    // if this is a redirect
    if ( page.meta.type === 'redirect' ) {
        return res.redirect(page.meta.to);
    }

    // if this is a redirect
    if ( page.meta.type === 'redirect' ) {
        return res.redirect(page.meta.to);
    }

    // if this page is already rendered
    if ( page.meta.type === 'rendered' ) {
        res.set('Content-Type', page.meta.contentType);
        return res.send(page.content);
    }

    // ToDo: all res.render() stuff needs to be like this instead:
    // * https://github.com/visionmedia/serve/blob/master/bin/serve#L55

    // content: index and page
    if ( page.meta.type === 'index' ) {
        return res.render('index', page);
    }

    // blog: index and post
    if ( page.meta.type === 'blog' ) {
        return res.render('blog', page);
    }
    if ( page.meta.type === 'archive' ) {
        return res.render('archive', page);
    }
    if ( page.meta.type === 'post' ) {
        return res.render('post', page);
    }

    // if we have no type so far, just default it to 'page'
    return res.render('page', page);
}

// if we call cb(err, true) then we have dealt with the request
function serveStatic(req, res, site, path, cb) {
    // see if we want to serve something static
    send(req, path)
        .index(false)
        .root(site.htdocs)
        .on('error', function(err) {
            // if this was a not-found, send it rather than a server error
            res.statusCode = err.status || 500;
            res.end(err.code === 'ENOENT' ? '404 - Not Found\r\n' : err.message);
            cb();
        })
        .on('file', function(path, stat) {
            log('wanting a file');
        })
        .on('end', function(path, stat) {
            log('ended the streaming');
        })
        .on('directory', function() {
            log('Doing a directory');
            res.statusCode = 301;
            res.setHeader('Location', req.url + '/');
            res.end('Redirecting to ' + req.url + '/');
        })
        .pipe(res)
    ;
}
