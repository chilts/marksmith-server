all:

server:
	supervisor --no-restart-on error --no-restart-on exit server.js

.PHONY: all server
