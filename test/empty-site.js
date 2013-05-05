var marksmith = require('../lib/marksmith.js');
var test = require('tape');

test('Empty Site', function(t) {
    marksmith(__dirname + '/empty-site/', function(err, pages) {
        console.log(pages);
        t.deepEqual(pages, { '/' : { url : '/' } }, 'Empty site is pretty empty');
        t.end();
    });
});
