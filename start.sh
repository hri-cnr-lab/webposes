#!/usr/bin/env bash

source ./venv/bin/activate

node webposes.js 
#node webposes.js &> logs/access.log &
#./webposes.js &> logs/access.log &

deactivate
