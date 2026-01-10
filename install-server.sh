#!/bin/bash
#
# OtherThing (RhizOS Cloud) Server Install Script
# Run on a fresh Ubuntu 22.04+ server
#
# Usage: curl -fsSL https://raw.githubusercontent.com/Huck-dev/rhizos-cloud/main/install-server.sh | bash
#

set -e

echo "========================================"
echo "  OtherThing Server Installation"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    warn "Not running as root. Will use sudo for system commands."
    SUDO="sudo"
else
    SUDO=""
fi

# 1. Update system
log "Updating system packages..."
$SUDO apt update
$SUDO apt upgrade -y

# 2. Install dependencies
log "Installing dependencies..."
$SUDO apt install -y curl git nginx

# 3. Install Node.js 20.x
log "Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt install -y nodejs
fi
node --version

# 4. Install pnpm
log "Installing pnpm..."
if ! command -v pnpm &> /dev/null; then
    $SUDO npm install -g pnpm
fi
pnpm --version

# 5. Clone repo
log "Cloning repository..."
INSTALL_DIR="/opt/rhizos-cloud"
if [ -d "$INSTALL_DIR" ]; then
    warn "Directory $INSTALL_DIR already exists. Pulling latest..."
    cd $INSTALL_DIR
    git pull
else
    $SUDO git clone https://github.com/Huck-dev/rhizos-cloud.git $INSTALL_DIR
    $SUDO chown -R $USER:$USER $INSTALL_DIR
fi
cd $INSTALL_DIR

# 6. Install dependencies
log "Installing project dependencies..."
pnpm install

log "Installing orchestrator dependencies..."
cd src/orchestrator
pnpm install
cd ../..

log "Installing desktop dependencies..."
cd src/desktop
pnpm install

# 7. Build frontend
log "Building frontend..."
pnpm build
cd ../..

# 8. Configure nginx
log "Configuring nginx..."
$SUDO cp nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built frontend to nginx
$SUDO rm -rf /usr/share/nginx/html/*
$SUDO cp -r src/desktop/dist/* /usr/share/nginx/html/

# Test nginx config
$SUDO nginx -t

# 9. Create systemd service for orchestrator
log "Creating systemd service..."
$SUDO tee /etc/systemd/system/otherthing.service > /dev/null << 'EOF'
[Unit]
Description=OtherThing Orchestrator
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rhizos-cloud/src/orchestrator
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
EOF

# 10. Start services
log "Starting services..."
$SUDO systemctl daemon-reload
$SUDO systemctl enable otherthing
$SUDO systemctl restart otherthing
$SUDO systemctl restart nginx

# 11. Check status
sleep 3
log "Checking service status..."
$SUDO systemctl status otherthing --no-pager -l | head -15

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "========================================"
echo -e "${GREEN}  Installation Complete!${NC}"
echo "========================================"
echo ""
echo "  Web UI:     http://$SERVER_IP"
echo "  API:        http://$SERVER_IP/api/v1/health"
echo "  WebSocket:  ws://$SERVER_IP/ws/node"
echo ""
echo "  Logs: sudo journalctl -u otherthing -f"
echo ""
echo "  To connect a node:"
echo "  ./rhizos-node start -o http://$SERVER_IP -w <workspace-id>"
echo ""
