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
var jade = require('jade');
var marksmith = require('marksmith');

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

async.series([
    // firstly, read in all the /etc/marksmith.d/* files
    function(done) {
        log('Reading in each config file ...');
        async.forEachSeries(
            files,
            readSiteFiles,
            done
        );
    },
    // now process each site to read in all of the jade files
    function(done) {
        log('Compiling all templates ...');

        Object.keys(site).forEach(function(siteName) {
            log('* site = ' + siteName);
            var thisSite = site[siteName];
            var pageNames = Object.keys(thisSite.pages);

            // set up where the templates will live
            thisSite.template = {};

            pageNames.forEach(function(pageName) {
                var page = thisSite.pages[pageName];
                if ( !page || !page.meta || !page.meta.type ) {
                    return;
                }

                var type = page.meta.type;

                // if this page is already rendered
                if ( type === 'rendered' || type === 'redirect' ) {
                    return;
                }

                // if we already have this template loaded, skip it
                if ( thisSite.template[type] ) {
                    return;
                }

                log('-> ' + type);

                // read this template in
                var filename = thisSite.views + '/' + type + '.jade';
                var text = fs.readFileSync(filename, 'utf8');
                thisSite.template[type] = jade.compile(text, { filename : filename });
            });
        });

        log('Finished reading all site templates');
        done();
    },
    startServer
]);

function readSiteFiles(filename, done) {
    log('Reading ' + cfgDir + '/' + filename);

    var stat = fs.statSync(cfgDir + '/' + filename);
    if ( stat.isDirectory() ) {
        return done();
    }

    // read the site info from the config file
    var config = iniparser.parseSync(cfgDir + '/' + filename);
    config.hostnames = config.hostnames.split(',');

    var plugins = [];
    if ( config.plugins ) {
        plugins = config.plugins.split(',');
    }
    log('Hostnames : ' + JSON.stringify(config.hostnames));
    log('Content   : ' + JSON.stringify(config.content));
    log('Htdocs    : ' + JSON.stringify(config.htdocs));
    log('Views     : ' + JSON.stringify(config.views));
    log('Plugins   : ' + JSON.stringify(plugins));

    // now, load up the marksmith info for this site
    marksmith(config.content, plugins, console.log, function(err, pages) {
        if (err) throw err;

        // store these pages into this config
        config.pages = pages;

        console.log(pages['/blog/rss.xml']);

        // all done, store this entire site into the main config
        config.hostnames.forEach(function(hostname) {
            log('Hostname=' + hostname);
            site[hostname] = config;
        });

        done();
    });
}

function startServer(done) {

    var total = Object.keys(site).length;
    log('Read ' + total + ' sites');

    // create the server
    var server = http.createServer();
    server.on('request', function(req, res) {
        var path = url.parse(req.url).pathname;

        // firstly, get the host
        var host = req.headers.host;
        log(req.method + ' ' + host + path);

        // see if we are meant to serve this host
        if ( !site[host] ) {
            // 404
            log('Unknown host ' + host);
            res.statusCode = 404;
            return res.end('404 - Not Found\r\n');
        }

        // ok, we're meant to serve this site
        var thisSite = site[host];

        // for this page, we will either serve a page or a static file
        if ( thisSite.pages[path] ) {
            serveContent(req, res, thisSite, path);
        }
        else {
            // if the static page isn't found, this will serve a 404
            serveStatic(req, res, thisSite, path);
        }
    });

    server.listen(port, function() {
        log('Server listening on port ' + port);
    });
}

// serve the content
function serveContent(req, res, site, path) {
    // get the page
    var page = site.pages[path];
    if ( !page.content ) {
        page.content = '';
    }

    // get the type (if there)
    var type = page.meta && page.meta.type;

    // if there is no type, then serve a 500 since we don't know what to do
    if ( !type ) {
        res.statusCode = 500;
        res.end('500 - Internal Server Error');
    }

    // if this is a redirect
    if ( type === 'redirect' ) {
        res.redirect(page.meta.to);
        return;
    }

    // if this page is already rendered
    if ( type === 'rendered' ) {
        res.setHeader('Content-Type', page.meta.contentType);
        res.end(page.content);
        return;
    }

    // if this page is of type 'jade', then render it
    if ( type === 'blog' || type === 'post' || type === 'page'  || type === 'index' ) {
        var html = site.template[type](page);
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
        return;
    }

    // don't know what this is, or whether we ever get here
    throw new Error("Unknown page type : " + type);
}

// if we call cb(err, true) then we have dealt with the request
function serveStatic(req, res, site, path) {
    // see if we want to serve something static
    send(req, path)
        .index(false)
        .root(site.htdocs)
        .on('error', function(err) {
            // if this was a not-found, send it rather than a server error
            res.statusCode = err.status || 500;
            res.end(err.code === 'ENOENT' ? '404 - Not Found\r\n' : err.message);
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
