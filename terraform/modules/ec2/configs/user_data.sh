#!/bin/bash
set -e

# Node 22 — node:sqlite doesn't exist before this
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git nginx

# Clone and build as the ubuntu user, not root, so file ownership is sane
sudo -u ubuntu git clone https://github.com/Rajshekhar142/lt-4.0.git /home/ubuntu/lifetracker
cd /home/ubuntu/lifetracker
sudo -u ubuntu npm install
sudo -u ubuntu npm run build

# pm2: install globally, run the app as ubuntu, register with systemd
npm install -g pm2
sudo -u ubuntu pm2 start npm --name lifetracker --cwd /home/ubuntu/lifetracker -- start
sudo -u ubuntu pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash

# Nginx reverse proxy on port 80 -> Next.js on 3000
cat > /etc/nginx/sites-available/lifetracker <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -sf /etc/nginx/sites-available/lifetracker /etc/nginx/sites-enabled/lifetracker
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
