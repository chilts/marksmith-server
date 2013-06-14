# Marksmith Server #

## What is it? ##

Marksmith is a server which can look at a directory full of markdown files, assets and templates and serve them up on
the port of your choosing. It uses the ```marksmith``` module to convert a directory into a data structure, which this
server can serve up in conjunction with a directory of templates and a directory of static assets.

## Sites ##

To tell Marksmith Server to serve a site, you need to drop a file into ```/etc/marksmith.d/``` which points to the
correct locations. For example ```/etc/marksmith.d/chilts-org.ini``` might look like:

```
hostnames=chilts.org
content=/home/chilts/src/chilts-org/content
htdocs=/home/chilts/src/chilts-org/public
views=/home/chilts/src/chilts-org/views
plugins=...,...,...
```

(We'll talk about plugins later.)

This will use [marksmith](https://github.com/chilts/marksmith) to read in all of the content in the ```content```
directory. It will serve any static assets from the ```htdocs``` directory and will use all the templates in
```views``` to render any pages needing a template.

## Use in conjunction with Proximity ##

Use Marksmith Server in conjunction with Proximity so that Proximity will proxy all requests through to Marksmith
Server for the site you have created. For example, by dropping the following file into
```/etc/proximity.d/chilts-org```, you'll tell Proximity to proxy through to Marksmith Server, which already knows how
to serve ```chilts.org```:

```
; proxy to Marksmith
[chilts.org]
type=proxy
host=localhost
port=5000

[www.chilts.org]
type=redirect
to=chilts.org
```

Proximity also takes care of sitewide redirects too, as you can see here where ```www.chilts.org``` is being redirected
to ```chilts.org```.

# About the Name #

"Marksmith" is a cross between "MarkDown" and "Wordsmith" (not "Mark Smith"). It takes Node's tradition of using *smith
as names for static site generators.

# Author #

Written by [Andrew Chilton](http://chilts.org/) - [Blog](http://chilts.org/blog/) - [Twitter](https://twitter.com/andychilton).

# License #

* http://chilts.mit-license.org/2013/

(Ends)
