var marksmith = require('../lib/marksmith.js');
var test = require('tape');

test('Simple Site', function(t) {
    marksmith(__dirname + '/simple-site/', function(err, pages) {
        var site = {
            '/' : {
                content: '<p>This is the main index page.</p>\n',
                meta: {
                    title: 'My Homepage', type: 'content'
                },
                cfg: {
                    title: 'simplesite.example.com'
                },
                url: '/'
            }
        };

        t.deepEqual(pages, site, 'Empty site is pretty empty');
        t.end();
    });
});
