#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

SECRETS=/etc/barterapp/secrets.env

#geslo naredimo samo ob prvem zagonu
install -d -m 750 /etc/barterapp
if [ ! -f "$SECRETS" ]; then
    echo "DB_PASSWORD=$(openssl rand -hex 16)" > "$SECRETS"
    chmod 600 "$SECRETS"
fi
source "$SECRETS"

apt-get install -y postgresql

#Uporabnik in baza
if ! sudo -u postgres psql -tAc "SELECT 1 from pg_roles WHERE rolname='barter'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE ROLE barter LOGIN PASSWORD '$DB_PASSWORD'"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='barter'" | grep -q 1; then
  sudo -u postgres createdb -O barter barter
fi

PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U barter -d barter -f /repo/app/backend/db/schema.sql
