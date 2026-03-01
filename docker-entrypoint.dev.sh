#!/bin/sh
set -e
exec nodemon --exec "/bin/sh /usr/src/app/docker-exec.dev.sh"
