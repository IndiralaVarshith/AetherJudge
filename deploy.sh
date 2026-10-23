#!/bin/bash
# ==============================================================================
# AetherJudge 1-Click Production VM Deployment Script (₹0 Always Free VM)
# Supports: Ubuntu 22.04 LTS / Debian 12 (x86_64 / amd64)
# ==============================================================================

set -e

echo "🚀 Starting AetherJudge Production Deployment..."

# 1. Update system packages
echo "📦 Updating package lists..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw iptables

# 2. Configure 4GB Swap Space (Essential for Free-Tier 1GB RAM instances)
if [ ! -f /swapfile ]; then
    echo "💾 Creating 4GB swap space to support Java/C++ compilation on free-tier RAM..."
    sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    sudo sysctl vm.swappiness=10
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    echo "✅ Swap configured successfully."
else
    echo "✅ Swap space already exists."
fi

# 3. Install Docker & Docker Compose if missing
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker Engine and Docker Compose plugin..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed."
fi

# 4. Configure Firewall (UFW)
echo "🛡️ Configuring firewall rules..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

# 5. Start Unified AetherJudge Production Stack
echo "🚀 Building and starting containers via docker-compose.prod.yml..."
docker compose -f docker-compose.prod.yml up -d --build

# 6. Wait for health check
echo "⏳ Waiting for API to become healthy..."
sleep 15

if curl -s http://localhost/health | grep -q "ok"; then
    echo "🎉 AetherJudge Backend & Judge0 Stack deployed successfully!"
    echo "Public HTTP Endpoint: http://$(curl -s ifconfig.me)/"
    echo "Health Endpoint:      http://$(curl -s ifconfig.me)/health"
    echo "API Endpoint:         http://$(curl -s ifconfig.me)/api"
else
    echo "⚠️ Stack started. Checking container status:"
    docker compose -f docker-compose.prod.yml ps
fi
