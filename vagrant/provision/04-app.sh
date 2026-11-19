#!/usr/bin/env bash
set -euo pipefail 
export DEBIAN_FRONTEND=noninteractive

source /etc/barterapp/secrets.env
APP_DIR=/opt/barterapp/backend


#installamo node.js
if [ ! -f /etc/apt/sources.list.d/nodesource.list ]; then 
    apt-get install -y gnupg curl ca-certificates
    install -d -m 755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update
fi

apt-get install -y nodejs rsync

#navaden user za API
id barterapp > /dev/null 2>&1 || useradd --system --no-create-home --shell /usr/bin/nologin barterapp

# kopiranje iz deljene mape, namestitev requirements, prevod
install -d /opt/barterapp
rsync -a --delete --exclude node_modules --exclude dist --exclude .env /repo/app/backend/ "$APP_DIR/"

cd $APP_DIR

npm ci
npm run build
npm prune --omit=dev

# konfiguracije iz skrivnosti
cat > /etc/barterapp/backend.env <<EOF
PORT=3000
DATABASE_URL=postgres://barter:${DB_PASSWORD}@127.0.0.1:5432/barter
REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379
SESSION_TTL_SECONDS=86400
EOF
chmod 600 /etc/barterapp/backend.env

# systemd servici
cat > /etc/systemd/system/barterapp.service <<'EOF'
[Unit]
Description=BarterApp API
After=network.target postgresql.service redis-server.service

[Service]
User=barterapp
Group=barterapp
WorkingDirectory=/opt/barterapp/backend
EnvironmentFile=/etc/barterapp/backend.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable barterapp
systemctl restart barterapp



