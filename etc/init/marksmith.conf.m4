## ----------------------------------------------------------------------------
#
# Bookmarks
#
# http://kvz.io/blog/2009/12/15/run-nodejs-as-a-service-on-ubuntu-karmic/
#
## ----------------------------------------------------------------------------

# info
description "marksmith-server - Web server to serve up (markdown+assets+templates) -> (site+feeds) to your readers."
author      "Andrew Chilton"

# respawn this task
start on runlevel [2345]
respawn
respawn limit 20 5
stop on shutdown

# allow opening of more than 1024 files
limit nofile 4096 4096

# set some environment variables
env NODE_ENV=production

# the script itself
script

    # quit the script if something goes wrong
    set -e

    # run the webserver as ubuntu
    exec \
        sudo -E -u __USER__ \
        __NODE__ \
        __PWD__/marksmith.js 9000 \
        >> /var/log/marksmith/access.log

end script

## ----------------------------------------------------------------------------
