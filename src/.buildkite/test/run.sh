#!/bin/bash

set -ex

# Thanks to https://gist.github.com/sj26/88e1c6584397bb7c13bd11108a579746
# Retry a command up to a specific numer of times until it exits successfully,
# with exponential back off.
#
#  $ retry 5 echo Hello
#  Hello
#
#  $ retry 5 false
#  Retry 1/5 exited 1, retrying in 1 seconds...
#  Retry 2/5 exited 1, retrying in 2 seconds...
#  Retry 3/5 exited 1, retrying in 4 seconds...
#  Retry 4/5 exited 1, retrying in 8 seconds...
#  Retry 5/5 exited 1, no more retries left.
#  
function retry {
  local retries=$1
  shift

  local count=0
  until "$@"; do
    exit=$?
    wait=$((2 ** $count))
    count=$(($count + 1))
    if [ $count -lt $retries ]; then
      echo "Retry $count/$retries exited $exit, retrying in $wait seconds..."
      sleep $wait
    else
      echo "Retry $count/$retries exited $exit, no more retries left."
      return $exit
    fi
  done
  return 0
}

npm i --silent -g pnpm@5.15.1 --unsafe-perm

retry 5 pnpm i --no-prefer-frozen-lockfile

# Only run lint for job 0
if [ "$BUILDKITE_PARALLEL_JOB" = "0" ]; then
    pnpm run lint
fi

node -v
npm -v

cd src

retry 5 pnpm i --no-prefer-frozen-lockfile

pnpm run setup

pnpm run test
