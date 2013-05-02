// ----------------------------------------------------------------------------
//
// marksmith.js - load up and parse all files in a Marksmith site.
//
// Copyright 2013 Andrew Chilton <andychilton@gmail.com>
//
// ----------------------------------------------------------------------------

var fs = require('fs');

var async = require('async');
var fmt = require('fmt');
var marked = require('marked');

// ----------------------------------------------------------------------------

// set up 'marked'
marked.setOptions({
    gfm        : true,
    tables     : true,
    breaks     : false,
    pedantic   : false,
    sanitize   : true,
    smartLists : true,
    langPrefix : 'language-',
});

// ----------------------------------------------------------------------------

// process all the files
function process(queue, store, item, callback) {
    fmt.line();
    fmt.field( 'Processing Filename', item.filename );
    fmt.field( 'Current Path',        item.path     );
    fmt.field( 'Base Name',           item.base     );

    // get the 'url' for this item
    var url = item.filename.substr(item.base.length);
    fmt.field( 'url1', url );
    if ( item.baseName === '.cfg.json' ) {
        url = url.replace(/\.cfg\.json$/, '');
    }
    if ( item.filename.match(/\/index.json$/) ) {
        url = url.replace(/\/index.json$/, '/');
    }
    if ( item.filename.match(/\.json$/) ) {
        url = url.replace(/\.json$/, '');
    }
    if ( item.filename.match(/\/index.md$/) ) {
        url = url.replace(/\/index.md$/, '/');
    }
    if ( item.filename.match(/\.md$/) ) {
        url = url.replace(/\.md$/, '');
    }
    if ( url === '' ) {
        url = '/';
    }
    fmt.field( 'url2', url );

    // firstly, check if this is a directory or a filename
    fs.stat(item.filename, function(err, stat) {
        if (err) {
            console.log(err);
            return callback(err);
        }

        if ( stat.isDirectory() ) {
            console.log('Found directory     : ' + item.filename);

            // save this as a directory
            if ( url === '/' ) {
                store['/'] = store['/'] || {};
            }
            else {
                // store a redirect first
                console.log('=== *** === Storing redirect at ' + url);
                store[url] = {
                    meta : {
                        type   : 'redirect',
                        to     : url + '/',
                    }
                };

                // store for a new dir
                store[url + '/'] = {};
            }

            // this is a directory
            fmt.field('Reading dir', item.filename);
            fs.readdir(item.filename, function(err, files) {
                files.forEach(function(filename, i) {
                    // ignore backups and temporary files
                    if ( filename.match(/(^\#)|(^\.\#)|(~$)/) ) {
                        return;
                    }
                    fmt.field('Found file', filename);

                    queue.push({
                        filename : item.filename + '/' + filename,
                        base     : item.base,
                        path     : item.path,
                        baseName : filename,
                    });
                });
                callback();
            });
        }
        else {
            // this is a file, read it and continue
            fmt.field('Reading file', item.filename);
            fs.readFile(item.filename, 'utf8', function(err, data) {
                // make the item if it doesn't already exist
                store[url] = store[url] || {};

                if ( item.filename.match(/\.json$/) ) {
                    fmt.field('Type', 'json');
                    if ( item.filename.match(/\.cfg.json$/) ) {
                        fmt.field('Found', 'Directory Config');

                        // config JSON
                        fmt.field('Storing data', url);
                        store[url].cfg = JSON.parse(data);
                    }
                    else {
                        fmt.field('Found', 'Page Config');

                        // regular page JSON
                        fmt.field('Storing data', url);
                        store[url].meta = JSON.parse(data);
                    }
                }
                if ( item.filename.match(/\.md$/) ) {
                    fmt.field('Type', 'md');
                    console.log(data);
                    fmt.field('Storing content', url);
                    store[url].content = marked(data);
                }
                fmt.dump(store[url], 'page');
                callback();
            });
        }
    });
};

module.exports = function(dir, done) {

    // remove the trailing slash off the dir
    dir = dir.replace(/\/$/, '');

    // make a new store
    var store = {};

    // use a queue to do each file one-by-one
    var queue = async.queue(
        function(item, callback) {
            process(queue, store, item, callback);
        },
        1
    );

    // when everything has been done, call the done()
    queue.drain = function() {
        // all finished
        fmt.line();
        done(null, store);
    };

    // now start the whole thing off
    queue.push({ base : dir, filename : dir, path : '/' }, function(err) {
        console.log('Finished processing : ' + dir);
    });
};

// ----------------------------------------------------------------------------
