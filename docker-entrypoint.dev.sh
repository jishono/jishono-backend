#!/bin/sh
set -e
exec /usr/src/app/node_modules/.bin/nodemon --exec "/bin/sh /usr/src/app/docker-exec.dev.sh"
