#!/bin/bash

docker build --no-cache -t bot .
docker rmi $(docker images -qa -f 'dangling=true')
docker-compose up -d
