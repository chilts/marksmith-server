// ----------------------------------------------------------------------------
//
// marksmith.js - load up and parse all files in a Marksmith site.
//
// Copyright 2013 Andrew Chilton <andychilton@gmail.com>
//
// ----------------------------------------------------------------------------

var fs = require('fs');
var crypto = require('crypto');

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
    fmt.field( 'Root',                item.root     );

    // get the 'url' for this item
    var url = item.filename.substr(item.root.length);
    if ( url === '' ) {
        url = '/';
    }
    fmt.field( 'Current URL',         item.url      );

    // make the item is created if it doesn't already exist
    store[url] = store[url] || {};

    // firstly, check if this is a directory or a filename
    fs.stat(item.filename, function(err, stat) {
        if (err) {
            console.log(err);
            return callback(err);
        }

        if ( stat.isDirectory() ) {
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
                        root     : item.root,
                        filename : item.filename + '/' + filename,
                        url      : item.url,
                    });
                });
                callback();
            });
        }
        else {
            // this is a file, read it and continue
            fs.readFile(item.filename, 'utf8', function(err, data) {
                // data from the file
                fmt.field('Storing Data', url);
                store[url] = store[url] || {};
                store[url].data = data;
                callback();
            });
        }
    });
};

function pluginDecodeCfgJsonForDir(store) {
    fmt.line();
    fmt.title('Plugin : Decode JSON to Meta');

    var urls = Object.keys(store);

    urls = urls.filter(function(url) {
        // looks like "/.cfg.json" or "/path/.cfg.json"
        return url.match(/\/\.cfg\.json$/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Saving Cfg', url);

        var dir = url.replace(/\.cfg\.json$/, '');
        fmt.field('To Dir ->', dir);

        store[dir] = store[dir] || {};
        store[dir].cfg = JSON.parse(store[url].data);
        delete store[url];
    });
}

function pluginConvertMarkdownToContent(store) {
    fmt.line();
    fmt.title('Plugin : Convert Markdown to Content');

    var urls = Object.keys(store);
    urls = urls.filter(function(url) {
        // looks like "*.md"
        return url.match(/\.md$/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Converting Markdown', url);

        var newUrl = url.replace(/\.md$/, '');
        fmt.field('To ->', newUrl);

        store[newUrl] = store[newUrl] || {};
        store[newUrl].content = marked(store[url].data);
        delete store[url];
    });
}

function pluginDecodeJsonToMeta(store) {
    fmt.line();
    fmt.title('Plugin : Decode JSON to Meta');

    var urls = Object.keys(store);
    urls = urls.filter(function(url) {
        // looks like "*.json"
        return url.match(/\.json$/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Converting JSON', url);
        // fmt.field('JSON ', store[url].data);

        var newUrl = url.replace(/\.json$/, '');
        fmt.field('To ->', newUrl);

        store[newUrl] = store[newUrl] || {};
        store[newUrl].meta = JSON.parse(store[url].data);
        delete store[url];
    });
}

function pluginConvertIndexToDir(store) {
    fmt.line();
    fmt.title('Plugin : Convert Index to Dir');

    var urls = Object.keys(store);
    urls = urls.filter(function(url) {
        // looks like "*/index"
        return url.match(/\/index$/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Converting Index', url);

        var newUrl = url.replace(/\/index$/, '/');
        fmt.field('To ->', newUrl);

        var keys = Object.keys(store[url]);
        keys.forEach(function(key, i) {
            store[newUrl][key] = store[url][key];
        });
        delete store[url];
    });
}

function pluginSetUrls(store) {
    fmt.line();
    fmt.title('Plugin : Set URLs');

    var urls = Object.keys(store);

    urls.forEach(function(url, i) {
        fmt.field('Set URLs', url);
        store[url].url  = url;
    });
}

function pluginMakeAuthorGravatarFromEmail(store) {
    fmt.line();
    fmt.title('Plugin : Make Author Gravatar from Email');

    // only get the pages with 'author.email' info
    var urls = Object.keys(store);

    urls = urls.filter(function(url) {
        var page = store[url];
        return page && page.meta && page.meta.author && page.meta.author.email;
    });

    urls.forEach(function(url, i) {
        fmt.field('GravatarUrl', url);

        var email = store[url].meta.author.email.trim().toLowerCase();

        var md5 = crypto.createHash('md5').update(email).digest('hex');

        store[url].meta.author.gravatarUrl = 'http://www.gravatar.com/avatar/' + md5 + '.jpg';
    });
}

function pluginMakeGravatarUrlSizes(sizes) {
    return function(store) {
        fmt.line();
        fmt.title('Plugin : Gravatar sizes = ' + JSON.stringify(sizes));

        // only get the pages with 'author.gravatarUrl' info
        var urls = Object.keys(store);

        urls = urls.filter(function(url) {
            var page = store[url];
            return page && page.meta && page.meta.author && page.meta.author.gravatarUrl;
        });

        urls.forEach(function(url, i) {
            fmt.field('GravatarUrlSize', url);
            var gravatarUrl = store[url].meta.author.gravatarUrl;

            store[url].meta.author.gravatarUrlSize = {};

            sizes.forEach(function(size, i) {
                store[url].meta.author.gravatarUrlSize[size] = gravatarUrl + '?s=' + size
            });
        });
    };
}

function pluginMakeDirRedirects(store) {
    fmt.line();
    fmt.title('Plugin : Dir Redirects');

    var dirs = Object.keys(store);

    dirs = dirs.filter(function(dir) {
        return dir !== '/' && dir.match(/\/$/);
    });

    dirs.forEach(function(dir, i) {
        fmt.field('DirRedirects', dir);

        var newDir = dir.replace(/\/$/, '');
        fmt.field('Redirecting', '' + newDir + ' to ' + dir );

        // generate the redirec
        store[newDir] = {
            meta : {
                type   : 'redirect',
                to     : dir,
            }
        };
    });
}

function pluginMakeBlogIndexes(store) {
    fmt.line();
    fmt.title('Plugin : Blog Indexes');
    var dirNames = Object.keys(store);

    dirNames = dirNames.filter(function(dirName) {
        return store[dirName].cfg && store[dirName].cfg.type === 'blog';
    });

    dirNames.forEach(function(dirName, i) {
        fmt.field('BlogIndexes', dirName);

        // finding all the pages in this blog
        store[dirName].posts = [];

        var pageNames = Object.keys(store);
        pageNames.forEach(function(pageName, i) {
            // don't add the same page
            if ( dirName === pageName ) {
                return;
            }

            if ( dirName === pageName.substr(0, dirName.length) ) {
                fmt.field('Adding', pageName);
                store[dirName].posts.push(store[pageName]);
            }
            else {
                fmt.field('Not Adding', pageName);
            }
        });

        // now sort the posts in reverse order
        store[dirName].posts = store[dirName].posts.sort(function(post1, post2) {
            return post1.meta.date < post2.meta.date;
        });
    });
}

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
        fmt.line();
        var paths = Object.keys(store);
        // fmt.dump(paths, 'Paths');

        // decode all .cfg.json files to the relevant directory
        pluginDecodeCfgJsonForDir(store);

        // convert all markdown to content
        pluginConvertMarkdownToContent(store);

        // convert all *.json files to 'meta'
        pluginDecodeJsonToMeta(store);

        // convert all '*/index' to '*/'
        pluginConvertIndexToDir(store);

        // set the URLs on all items
        pluginSetUrls(store);

        // make the Gravatar bits from the email address
        pluginMakeAuthorGravatarFromEmail(store);

        // make the Gravatar bits from the email address
        pluginMakeGravatarUrlSizes([ 24, 32, 40, 64, 128 ])(store);

        // make all of the blog plugin pages
        pluginMakeDirRedirects(store);

        // make all of the blog plugin pages
        pluginMakeBlogIndexes(store);

        // all finished
        fmt.line();

        done(null, store);
    };

    // now start the whole thing off
    var start = {
        root     : dir,
        filename : dir,
        url      : '/',
    };
    queue.push(start, function(err) {
        console.log('Finished processing : ' + dir);
    });
};

// ----------------------------------------------------------------------------
