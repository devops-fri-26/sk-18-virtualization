#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

CRT=/etc/ssl/certs/barterapp.crt
KEY=/etc/ssl/private/barterapp.key
WEB=/var/www/barterapp

apt-get install -y nginx openssl

#self signed cert pri prvem zagonu
if [ ! -f "$CRT" ]; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout "$KEY" -out "$CRT" -subj "/CN=barterapp.local" \
        -addext "subjectAltName=DNS:barterapp.local,DNS:localhost,IP:127.0.0.1"
    chmod 600 "$KEY"
fi


#začasna stran do FE
install -d "$WEB"
[ -f "$WEB/index.html" ] || echo "<h1>BarterApp</h1>" > "$WEB/index.html"

#konfiguracija strani
cat > /etc/nginx/sites-available/barterapp <<'EOF'
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

server {
    listen 80;
    listen 443 ssl;
    server_name _;

    ssl_certificate     /etc/ssl/certs/barterapp.crt;
    ssl_certificate_key /etc/ssl/private/barterapp.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    server_tokens off;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    root /var/www/barterapp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # prijava/registracija: strožja omejitev zahtevkov
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/barterapp /etc/nginx/sites-enabled/barterapp

nginx -t
systemctl enable nginx
systemctl reload nginx