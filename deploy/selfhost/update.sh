#!/usr/bin/env bash
# Pull the latest game from GitHub and rebuild/restart the server.
# Games in progress end when the container restarts.
set -euo pipefail
DIR="${DIR:-$HOME/game-server}"
BRANCH="${BRANCH:-samguk-skeleton}"
git -C "$DIR" fetch --depth 1 origin "$BRANCH"
git -C "$DIR" checkout -B "$BRANCH" FETCH_HEAD
cd "$DIR/deploy/selfhost"
sed -i "s/^GIT_COMMIT=.*/GIT_COMMIT=$(git -C "$DIR" rev-parse --short HEAD)/" .env
sudo docker compose up -d --build
sudo docker image prune -f >/dev/null
echo "Updated to $(git -C "$DIR" rev-parse --short HEAD)"
