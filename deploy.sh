#!/bin/bash
# ==============================================================================
# AetherJudge production deploy for a free x86 VM (Google Cloud Always Free
# e2-micro, or any Ubuntu 22.04 x86_64 server with a kernel that has cgroup v1).
#
#   ./deploy.sh            first install, and later updates (safe to re-run)
#
# What it does:
#   1. Checks the machine is x86_64 (the Judge0 image is x86-only) and that its
#      kernel still supports what Judge0's sandbox needs.
#   2. Switches the kernel to cgroup v1 if needed (Judge0 1.13 requires it) and
#      asks you to reboot once.
#   3. Adds 4 GB of swap (free VMs have 1 GB RAM).
#   4. Installs Docker.
#   5. Opens ports 80 and 443 in the VM's own firewall.
#   6. Creates .env.production with random secrets and a free HTTPS domain
#      (and updates that domain if the VM's public IP changed).
#   7. Builds and starts everything, then checks https://<API_DOMAIN>/health.
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")"

say()  { printf '\n\033[1;35m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$*"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$*"; }

# ── 1. Architecture ──────────────────────────────────────────────────────────
say "Checking the machine"
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ]; then
  echo "  This server is $ARCH. Judge0 only ships x86_64 images, so use an x86 (AMD/Intel) VM,"
  echo "  e.g. Google Cloud's e2-micro."
  exit 1
fi
ok "x86_64"

# Judge0 1.13 limits memory with the old cgroup v1 memory controller. Newer kernels
# (e.g. Ubuntu 24.04 on Google Cloud, kernel 6.11+) can be built without it, and then
# every submission fails. Ubuntu 22.04 (kernel 6.8) still has it.
KCONFIG="/boot/config-$(uname -r)"
if [ -f "$KCONFIG" ] && grep -q '^# CONFIG_MEMCG_V1 is not set' "$KCONFIG"; then
  echo "  This kernel ($(uname -r)) has no cgroup v1 memory controller (CONFIG_MEMCG_V1),"
  echo "  so Judge0 cannot run code here. Recreate the VM with Ubuntu 22.04 LTS (x86/64)."
  exit 1
fi

# ── 2. cgroup v1 for Judge0 ──────────────────────────────────────────────────
if [ "$(stat -fc %T /sys/fs/cgroup)" = "cgroup2fs" ]; then
  say "Switching to cgroup v1 (Judge0 1.13 sandboxing needs it)"
  if ! grep -q "systemd.unified_cgroup_hierarchy=0" /etc/default/grub; then
    sudo sed -i 's/^GRUB_CMDLINE_LINUX="\(.*\)"/GRUB_CMDLINE_LINUX="\1 systemd.unified_cgroup_hierarchy=0"/' /etc/default/grub
    # Some cloud images keep their kernel options in a drop-in file instead.
    for f in /etc/default/grub.d/*.cfg; do
      [ -f "$f" ] && grep -q '^GRUB_CMDLINE_LINUX_DEFAULT=' "$f" && \
        sudo sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 systemd.unified_cgroup_hierarchy=0"/' "$f"
    done
    sudo update-grub
  fi
  echo
  echo "  Done. Reboot once, reconnect, and run ./deploy.sh again:"
  echo "    sudo reboot"
  exit 0
fi
if ! grep -q '^memory' /proc/cgroups; then
  echo "  cgroup v1 is on, but the kernel has no memory controller, so Judge0 cannot run code."
  echo "  Recreate the VM with Ubuntu 22.04 LTS (x86/64)."
  exit 1
fi
ok "cgroup v1 with memory controller"

# ── 3. Swap ──────────────────────────────────────────────────────────────────
if [ ! -f /swapfile ]; then
  say "Adding 4 GB of swap"
  sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-aetherjudge.conf >/dev/null
  sudo sysctl -p /etc/sysctl.d/99-aetherjudge.conf >/dev/null
fi
ok "swap: $(swapon --show=SIZE --noheadings | head -1)"

# ── 4. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
  rm /tmp/get-docker.sh
  sudo usermod -aG docker "$USER"
fi
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="sudo docker" # group change applies after re-login
ok "$($DOCKER --version)"

# ── 5. Firewall ──────────────────────────────────────────────────────────────
say "Opening ports 80 and 443"
# Some cloud images (e.g. Oracle's) reject everything except SSH in iptables, on top
# of the cloud firewall. Insert ACCEPT rules first and keep them; harmless elsewhere.
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 1 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
  fi
done
if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save >/dev/null 2>&1 || true
else
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent >/dev/null 2>&1 && sudo netfilter-persistent save >/dev/null 2>&1 || true
fi
if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow 80/tcp >/dev/null; sudo ufw allow 443/tcp >/dev/null
fi
ok "ports 80 and 443 open on this machine (also allow them in your cloud firewall)"

# ── 6. Settings ──────────────────────────────────────────────────────────────
IP=$(curl -fsS --max-time 10 https://api.ipify.org || curl -fsS --max-time 10 https://ifconfig.me || true)
if [ ! -f .env.production ]; then
  say "Creating .env.production"
  [ -n "$IP" ] || { echo "  Could not find this server's public IP. Set API_DOMAIN in .env.production by hand."; }
  cp .env.production.example .env.production
  rand() { openssl rand -hex "$1"; }
  sed -i "s#^API_DOMAIN=.*#API_DOMAIN=${IP//./-}.sslip.io#" .env.production
  sed -i "s#^DB_PASSWORD=.*#DB_PASSWORD=$(rand 24)#" .env.production
  sed -i "s#^JWT_SECRET=.*#JWT_SECRET=$(rand 32)#" .env.production
  sed -i "s#^ADMIN_SECRET=.*#ADMIN_SECRET=$(rand 24)#" .env.production
  chmod 600 .env.production
  ok "API_DOMAIN=${IP//./-}.sslip.io, secrets generated"
  warn "Set CLIENT_ORIGIN (your Vercel URL) and GOOGLE_CLIENT_ID in .env.production when you have them."
fi
# A stopped-and-started VM can get a new public IP. Keep a free sslip.io name in sync.
CURRENT=$(grep -E '^API_DOMAIN=' .env.production | cut -d= -f2- || true)
if [ -n "$IP" ] && [[ "$CURRENT" == *.sslip.io ]] && [ "$CURRENT" != "${IP//./-}.sslip.io" ]; then
  sed -i "s#^API_DOMAIN=.*#API_DOMAIN=${IP//./-}.sslip.io#" .env.production
  warn "Public IP changed: API_DOMAIN is now ${IP//./-}.sslip.io (was $CURRENT)."
  warn "Update the /api destination in frontend/vercel.json to match, then push."
fi
set -a; . ./.env.production; set +a
for required in API_DOMAIN DB_PASSWORD JWT_SECRET; do
  [ -n "${!required:-}" ] || { echo "  $required is empty in .env.production"; exit 1; }
done

# ── 7. Start ─────────────────────────────────────────────────────────────────
COMPOSE="$DOCKER compose --env-file .env.production -f docker-compose.prod.yml"
say "Building the backend image (first run takes a few minutes)"
# The free VM has 1 GB of RAM. Pause the heavy containers while building, and build
# the image once with plain docker build (the API and the worker share it).
$DOCKER stop judge0-worker judge0-server aether-worker aether-api >/dev/null 2>&1 || true
if ! $DOCKER build -t aetherjudge-backend:latest ./backend; then
  warn "Build failed, retrying once"
  $DOCKER build -t aetherjudge-backend:latest ./backend
fi
$DOCKER image prune -f >/dev/null 2>&1 || true # drop the old image layers

say "Starting AetherJudge"
$COMPOSE up -d --no-build --remove-orphans

say "Waiting for https://$API_DOMAIN/health"
for i in $(seq 1 40); do
  if curl -fsS --max-time 5 "https://$API_DOMAIN/health" 2>/dev/null | grep -q ok; then
    ok "API is live at https://$API_DOMAIN"
    echo
    echo "  Next steps:"
    echo "   • Copy your problems (README → ₹0 Deployment → Step 3)."
    echo "   • In frontend/vercel.json set the /api destination to https://$API_DOMAIN/api/:path*"
    echo "     and deploy the frontend on Vercel."
    exit 0
  fi
  sleep 6
done
warn "Not reachable over HTTPS yet. Status of the containers:"
$COMPOSE ps
echo "  Check: ports 80/443 open in the cloud firewall, then: $COMPOSE logs caddy api"
exit 1
