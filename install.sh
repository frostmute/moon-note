#!/usr/bin/env bash
set -euo pipefail

APP_NAME="moon-note"
REPO_URL="${MOON_NOTE_REPO_URL:-https://github.com/frostmute/moon-note.git}"
APP_DIR="${MOON_NOTE_DIR:-$HOME/$APP_NAME}"
PORT="${PORT:-3000}"

info() { printf '\033[1;34m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
err() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    return 1
  fi
}

if ! need_cmd git; then
  err "Install Git, then run this script again."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  err "Docker is required. Install Docker, then run this script again:"
  err "  https://docs.docker.com/get-docker/"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  err "Docker Compose is required. Install the Docker Compose plugin, then run this script again."
  exit 1
fi

info "🌙 Installing Moon Note"
info "Repository: $REPO_URL"
info "Install dir: $APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
  info "Existing install found. Updating..."
  git -C "$APP_DIR" pull --ff-only
elif [ -e "$APP_DIR" ]; then
  err "$APP_DIR already exists but is not a Git repository."
  err "Choose another location with: MOON_NOTE_DIR=/path/to/moon-note bash install.sh"
  exit 1
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
mkdir -p data

info "Starting Moon Note on port $PORT..."
PORT="$PORT" "${COMPOSE[@]}" up -d --build

cat <<EOF

✅ Moon Note is running.

Open:      http://localhost:$PORT
Data:      $APP_DIR/data/notes.json
Manage:    cd $APP_DIR && docker compose logs -f
Stop:      cd $APP_DIR && docker compose down
Update:    bash $APP_DIR/install.sh

EOF
