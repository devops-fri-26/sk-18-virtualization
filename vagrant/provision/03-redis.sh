#!/usr/bin/env bash

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

SECRETS=/etc/barterapp/secrets.env
CONF=/etc/redis/redis.conf

#passw za redis, naredi se samo 1x
grep -q '^REDIS_PASSWORD' "$SECRETS" || echo "REDIS_PASSWORD=$(openssl rand -hex 16)" >> "$SECRETS"
source "$SECRETS"

apt-get install -y redis-server

#dodamo geslo še za redis
if grep -q '^requirepass' "$CONF"; then
    sed -i "s/^requirepass.*/requirepass $REDIS_PASSWORD/" "$CONF"
else
    echo "requirepass $REDIS_PASSWORD" >> "$CONF"
fi

systemctl restart redis-server
systemctl enable redis-server