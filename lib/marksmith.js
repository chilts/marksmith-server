// ----------------------------------------------------------------------------
//
// marksmith.js - load up and parse all files in a Marksmith site.
//
// Copyright 2013 Andrew Chilton <andychilton@gmail.com>
//
// ----------------------------------------------------------------------------

var fs = require('fs');
var crypto = require('crypto');

var _ = require('underscore');
var async = require('async');
var fmt = require('fmt');
var marked = require('marked');
var textile = require('textile-js');
var yaml = require('js-yaml');
var data2xml = require('data2xml')({ attrProp : '@', valProp  : '#' });

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

// run this function prior to any page rendering (acts only on URLs)
function moveInitialDateToMetaAndRename(store) {
    fmt.line();
    fmt.title('Plugin : Move Initial Date to Meta and Rename');

    var urls = Object.keys(store);
    urls = urls.filter(function(url) {
        // looks like "yyyy-mm-dd-*"
        return url.match(/\/\d\d\d\d-\d\d-\d\d-/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Moving Date to Meta and Renaming', url);

        var re = /\/(\d{4}-\d{2}-\d{2})-/;
        var m = url.match(re);
        console.log(m);

        var date = m[1]; // the captured match
        var newUrl = url.replace(re, '/');

        fmt.field('To ->', newUrl);
        fmt.field('Date ->', date);

        store[newUrl] = store[url];
        store[newUrl].meta = { date : date };
        delete store[url];
    });

}

function extractYamlFrontMatterFromDataLikeGitHubPages(store) {
    fmt.line();
    fmt.title('Plugin : Extract YAML Front Matter From Data Like GitHub Pages ...');

    var urls = Object.keys(store);
    urls = urls.filter(function(url) {
        // see if .data starts with "---\n"
        console.log(url + ' --- ' + (store[url].data && store[url].data.substr(0, 5)));
        return store[url].data && store[url].data.match(/^---\s*\n/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Extracting YAML Front Matter', url);

        var lines = store[url].data.split(/\n/);

        // lose the first line (which is just "---\n")
        lines.shift();

        var frontMatter = '';
        var data;
        lines.forEach(function(line) {
            if ( line === '---' ) {
                // no longer in the front matter
                data = '';
            }
            else {
                if ( data === undefined ) {
                    frontMatter += line + "\n";
                }
                else {
                    data += line + "\n";
                }
            }
        });

        // console.log('*** +++');
        // console.log(frontMatter);
        // console.log('*** ---');
        // console.log(data);
        // console.log('*** ===');

        // finally, set the meta and the new data
        store[url].meta = _.extend({}, store[url].meta, yaml.load(frontMatter));
        store[url].data = data;
        console.log(store[url]);
    });
}

function pluginMoveHtmlAsContent(store) {
    fmt.line();
    fmt.title('Plugin : Move HTML as Content');

    var urls = Object.keys(store);
    urls = urls.filter(function(url) {
        // looks like "*.html"
        return url.match(/\.html$/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Moving HTML to Content', url);

        var newUrl = url.replace(/\.html$/, '');
        fmt.field('To ->', newUrl);

        store[newUrl] = store[newUrl] || {};
        store[newUrl].content = store[url].data;
        store[newUrl].meta = _.extend({}, store[newUrl].meta, store[url].meta);
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
        store[newUrl].meta = _.extend({}, store[newUrl].meta, store[url].meta);
        delete store[url];
    });
}

function pluginConvertTextileToContent(store) {
    fmt.line();
    fmt.title('Plugin : Convert Textile to Content');

    var urls = Object.keys(store);
    urls = urls.filter(function(url) {
        // looks like "*.textile"
        return url.match(/\.textile$/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Converting Textile', url);

        var newUrl = url.replace(/\.textile$/, '');
        fmt.field('To ->', newUrl);

        store[newUrl] = store[newUrl] || {};
        store[newUrl].content = textile(store[url].data);
        store[newUrl].meta = _.extend({}, store[newUrl].meta, store[url].meta);
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

        var newUrl = url.replace(/\.json$/, '');
        fmt.field('To ->', newUrl);

        store[newUrl] = store[newUrl] || {};
        store[newUrl].meta = _.extend({}, store[newUrl].meta, JSON.parse(store[url].data));
        delete store[url];
    });
}

function pluginDecodeYamlToMeta(store) {
    fmt.line();
    fmt.title('Plugin : Decode Yaml to Meta');

    var urls = Object.keys(store);
    urls = urls.filter(function(url) {
        // looks like "*.yaml"
        return url.match(/\.yaml$/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Converting YAML', url);

        var newUrl = url.replace(/\.yaml$/, '');
        fmt.field('To ->', newUrl);

        store[newUrl] = store[newUrl] || {};
        store[newUrl].meta = _.extend({}, store[newUrl].meta, yaml.load(store[url].data));
        delete store[url];
    });
}

function pluginRenameIndexToDir(store) {
    fmt.line();
    fmt.title('Plugin : Rename Index to Dir');

    var urls = Object.keys(store);
    urls = urls.filter(function(url) {
        // looks like "*/index"
        return url.match(/\/index$/);
    });

    urls.forEach(function(url, i) {
        fmt.field('Renaming Index', url);
        console.log(store[url]);

        var newUrl = url.replace(/\/index$/, '/');
        fmt.field('To ->', newUrl);

        // set the newUrl to have something in it (if not there already)
        store[newUrl] = store[newUrl] || {};

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
        store[url].url = url;
        store[url].meta = store[url].meta || {};
        store[url].meta.url = url;
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

// sitemap    - yeah! (sitemap.xml, sitemap.txt)
// robots.txt - nah!

function pluginMakeBlogIndexes(store) {
    fmt.line();
    fmt.title('Plugin : Blog Indexes');

    // firstly, find all of the blog URLs
    var urls = Object.keys(store);
    var blogs = urls.filter(function(url) {
        // console.log(store[url].meta);
        if ( store[url].meta ) {
            if ( store[url].meta.type === 'blog' ) {
                return true;
            }
        }
        return false;
    });

    blogs.forEach(function(blogUrl, i) {
        fmt.field('BlogIndexes', blogUrl);

        // finding all the pages in this blog
        store[blogUrl].posts = [];

        // figure out the level number of the blog (e.g. '/' -> 1, '/blog/' -> 2)
        var blogUrlLevel = blogUrl.split('/').length - 1;

        var urls = Object.keys(store);
        urls.forEach(function(url, i) {
            // if this isn't a 'post', we don't add it
            if ( !store[url].meta ) {
                return;
            }
            if ( store[url].meta.type !== 'post' ) {
                return;
            }

            // don't add the blog itself!
            if ( blogUrl === url ) {
                return;
            }

            // if this url is a subset of the blogUrl
            // (ie. it looks like '/blog/something' for '/blog/'
            // but also has the same number of slashes so we don't get '/blog/this/that')
            var urlLevel = url.split('/').length - 1;
            if ( blogUrl === url.substr(0, blogUrl.length) && blogUrlLevel === urlLevel ) {
                fmt.field('Adding', url);
                store[blogUrl].posts.push(store[url]);
            }
            else {
                fmt.field('Not Adding', url);
            }
        });

        // sort the posts in order
        store[blogUrl].posts.sort(function(post1, post2) {
            return post1.meta.date < post2.meta.date ? -1 : post1.meta.date > post2.meta.date ? 1 : 0;
        });

        // but we want it in reverse order
        store[blogUrl].posts.reverse();

        // finally, also store this at /archive
        var archiveUrl = blogUrl + 'archive';
        store[archiveUrl] = store[archiveUrl] || {};
        store[archiveUrl].posts = store[blogUrl].posts;
    });
}

function pluginMakeBlogFeeds(store) {
    fmt.line();
    fmt.title('Plugin : Blog Feeds');

    var urls = Object.keys(store);
    // console.log(urls);
    urls = urls.filter(function(url) {
        // console.log(store[url].meta);
        if ( store[url].meta ) {
            if ( store[url].meta.type === 'blog' ) {
                return true;
            }
        }
        return false;
    });

    urls.forEach(function(url, i) {
        fmt.field('BlogFeeds', url);

        var home = store['/'];

        // ---
        // firstly, make and store the RSS feed
        var rss = {
            '@' : { version : '2.0' },
            channel : {
                title : home.cfg.title,
                description : home.cfg.description,
                link : 'http://' + home.cfg.domain + url,
                lastBuildDate : (new Date()).toISOString(),
                pubDate : (new Date()).toISOString(),
                ttl : 1800,
                item : [],
            }
        };

        rss.item = store[url].posts.map(function(post, i) {
            return {
                title : post.meta.title,
                description : post.content,
                link : 'http://' + home.cfg.domain + post.url,
                guid : 'http://' + home.cfg.domain + post.url,
                pubDate : post.meta.date,
            };
        });

        store[url + 'rss.xml'] = {
            meta : {
                type        : 'rendered',
                contentType : 'application/xml',
            },
            content : data2xml('rss', rss),
        };

        // ---
        // now, make the Atom feed

        var atom = {
            '@' : { xmlns : 'http://www.w3.org/2005/Atom' },
            title : home.cfg.title,
            link : {
                '@' : {
                    href : 'http://' + home.cfg.domain + url + 'atom.xml',
                    rel : 'self',
                },
            },
            updated : (new Date()).toISOString(),
            id : 'http://' + home.cfg.domain + '/',
            author : {
                name : 'Andrew Chilton',
                email : 'andychilton@gmail.com',
            },
            entry : [],
        };

        atom.entry = store[url].posts.map(function(post, i) {
            return {
                title : post.meta.title,
                id : 'http://' + home.cfg.domain + post.url,
                link : [
                    {
                        '@' : { href : 'http://' + home.cfg.domain + post.url }
                    },
                    {
                        '@' : {
                            href : 'http://' + home.cfg.domain + post.url,
                            rel : 'self'
                        }
                    }
                ],
                content : {
                    '@' : { type : 'html' },
                    '#' : post.content,
                },
                updated : post.meta.date,
            };
        });

        // make a page for the /atom feed
        store[url + 'atom.xml'] = {
            meta : {
                type        : 'rendered',
                contentType : 'application/xml',
            },
            content : data2xml('feed', atom),
        };
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

        // move the initial date part of the filename to the store[url].meta
        moveInitialDateToMetaAndRename(store);

        // if a bit of data starts with '---\n', then extract the YAML contained
        extractYamlFrontMatterFromDataLikeGitHubPages(store);

        // convert all the *.html files to content
        pluginMoveHtmlAsContent(store);

        // convert all markdown to content
        pluginConvertMarkdownToContent(store);

        // convert all textile to content
        pluginConvertTextileToContent(store);

        // convert all *.json files to 'meta'
        pluginDecodeJsonToMeta(store);

        // convert all *.yaml files to 'meta'
        pluginDecodeYamlToMeta(store);

        // convert all '*/index' to '*/'
        pluginRenameIndexToDir(store);

        // set the URLs on all items
        pluginSetUrls(store);

        // make the Gravatar bits from the email address
        pluginMakeAuthorGravatarFromEmail(store);

        // make the Gravatar bits from the email address
        pluginMakeGravatarUrlSizes([ 24, 32, 40, 64, 128 ])(store);

        // make all of the directories redirect to their '/' versions
        pluginMakeDirRedirects(store);

        // make all of the blog plugin pages
        pluginMakeBlogIndexes(store);
        pluginMakeBlogFeeds(store);

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
