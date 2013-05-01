# Marksmith #

Note: "Marksmith" is a cross between "MarkDown" and "Wordsmith" (not "Mark Smith").

## What is it? ##

Marksmith is a server which can look at a directory full of markdown files, assets and templates and serve them up on
the port of your choosing.

e.g.

```bash
$ node marksmith.js --dir path/to/site --port 3000
Server listening on port 3000
```

## Directory Layout ##

It's pretty easy. In your ```dir``` you need three other directories:

```
dir/
|- site/
|- views/
+- public/
```

In ```site/``` goes your Markdown files and any ```.config.json``` files you require.

In ```views/``` goes your Jade templates. Remember to create at least one of each of the following:

* post.jade
* index.jade
* archive.jade

In ```public/``` goes your static assets such as your JavaScript, CSS and images. Remember to minimise them using
something like [CSS Minifier](http://cssminifier.com/) and [JavaScript Minifier](http://javascript-minifier.com/).

# Author #

Written by [Andrew Chilton](http://chilts.org/) - [Blog](http://chilts.org/blog/) - [Twitter](https://twitter.com/andychilton).

# License #

* http://chilts.mit-license.org/2013/

(Ends)
