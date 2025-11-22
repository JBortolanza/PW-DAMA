#!/usr/bin/env bash
#only run once to deploy the server, change exec start for number of workers
set -euo pipefail

UNIT_PATH=/etc/systemd/system/pw-gunicorn.service
WORKDIR=/home/jan.bortolanza/pw
VENV_PATH=$WORKDIR/venv/bin

sudo tee "$UNIT_PATH" > /dev/null <<'EOF'
[Unit]
Description=PW Gunicorn server
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/home/jan.bortolanza/pw
Environment="PATH=/home/jan.bortolanza/pw/venv/bin"
ExecStart=/home/jan.bortolanza/pw/venv/bin/gunicorn \
  -k uvicorn.workers.UvicornWorker \
  -w 1 \
  --bind 127.0.0.1:8000 \
  app.main:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd, enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable --now pw-gunicorn.service

echo "Service installed and started. Check status with: sudo systemctl status pw-gunicorn.service"