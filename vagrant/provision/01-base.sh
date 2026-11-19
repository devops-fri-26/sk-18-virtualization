#!/usr/bin/env bash

# e- ustavi skripto ob prvi napaki, u javi napako za neobstoječo spremenljivko
set -euo pipefail
# onemogočimo postavljenje vprašanj ker jih noben ne more odgovorit
export DEBIAN_FRONTEND=noninteractive

apt-get update
#idempotentnost - istih stvari ne nameščamo večkrat
apt-get install -y curl ca-certificates
