#!/bin/bash
## ----------------------------------------------------------------------------

set -e

WHOAMI=`id -un`
GROUP=`id -gn`
NODE=`which node`
PWD=`pwd`

## ----------------------------------------------------------------------------

echo "Fetching new code ..."
git pull --rebase
echo

## ----------------------------------------------------------------------------

echo "Installing new npm packages ..."
npm install
echo

## ----------------------------------------------------------------------------

echo "Setting up various directories ..."
sudo mkdir -p /var/log/marksmith/
sudo chown $WHOAMI:$GROUP /var/log/marksmith/
echo

## ----------------------------------------------------------------------------

echo "Adding the logrotate.d config ..."
sudo cp etc/logrotate.d/marksmith /etc/logrotate.d/
echo

## ----------------------------------------------------------------------------

echo "Making the /etc/marksmith.d/ directory ..."
sudo mkdir -p /etc/marksmith.d/
echo

## ----------------------------------------------------------------------------

echo "Not copying anything for proximity, since each marksmith site does that ..."
echo

## ----------------------------------------------------------------------------

# add the upstart scripts
echo "Copying proximity.ini ..."
m4 \
    -D __USER__=$USER \
    -D __NODE__=$NODE \
    -D __PWD__=$PWD \
    etc/marksmith.ini.m4 | sudo tee /etc/marksmith.ini
echo

## ----------------------------------------------------------------------------

# add the upstart scripts
echo "Copying upstart scripts ..."
m4 \
    -D __USER__=$USER \
    -D __NODE__=$NODE \
    -D __PWD__=$PWD \
    etc/init/marksmith.conf.m4 | sudo tee /etc/init/marksmith.conf
echo

## ----------------------------------------------------------------------------

# restart proximity
echo "Restarting services ..."
sudo service marksmith restart
echo

## --------------------------------------------------------------------------------------------------------------------
