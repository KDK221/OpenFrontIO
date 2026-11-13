#!/usr/bin/env bash
# One-time setup of a self-hosted multiplayer server on a fresh Ubuntu VM
# (made for an Oracle Cloud Ampere A1 instance; any Ubuntu 22.04+ works).
#
#   curl -fsSL https://raw.githubusercontent.com/KDK221/OpenFrontIO/samguk-skeleton/deploy/selfhost/install.sh | bash
#   or, with your own domain already pointing at this server:
#   curl -fsSL ... | DOMAIN=play.example.com bash
#
# Without DOMAIN the server uses <ip>.sslip.io, a free name that points at
# this server's public IP, so HTTPS works with no domain of your own.
set -euo pipefail

REPO="https://github.com/KDK221/OpenFrontIO.git"
BRANCH="${BRANCH:-samguk-skeleton}"
DIR="${DIR:-$HOME/game-server}"

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
	curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER" || true

echo "==> Opening ports 80 and 443 in the VM firewall"
# Oracle's Ubuntu images ship iptables rules that reject everything but SSH,
# on top of the cloud's own security list (opened in the console).
for port in 80 443; do
	if ! sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
		sudo iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
	fi
done
if command -v netfilter-persistent >/dev/null 2>&1; then
	sudo netfilter-persistent save
fi

echo "==> Fetching the game"
if [ -d "$DIR/.git" ]; then
	git -C "$DIR" fetch --depth 1 origin "$BRANCH"
	git -C "$DIR" checkout -B "$BRANCH" FETCH_HEAD
else
	git clone --depth 1 -b "$BRANCH" "$REPO" "$DIR"
fi

cd "$DIR/deploy/selfhost"
if [ -z "${DOMAIN:-}" ]; then
	IP="$(curl -fsS4 https://api.ipify.org)"
	DOMAIN="${IP//./-}.sslip.io"
fi
CPUS="$(nproc)"
cat >.env <<ENV
DOMAIN=$DOMAIN
NUM_WORKERS=$CPUS
GIT_COMMIT=$(git -C "$DIR" rev-parse --short HEAD)
ENV

echo "==> Building and starting (the first build takes 5-15 minutes)"
sudo docker compose up -d --build

echo
echo "Done. The game is at: https://$DOMAIN"
echo "It can take a minute after this for the HTTPS certificate to arrive."
