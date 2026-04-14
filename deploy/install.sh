#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"/..
npm run build:prod
sudo cp deploy/hermes-workspace.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hermes-workspace
echo 'Installed. Run: sudo systemctl start hermes-workspace'
