#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"/..
npm run build:prod
sudo cp deploy/hermes-console.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hermes-console
echo 'Installed. Run: sudo systemctl start hermes-console'
