#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${1:-"."}
ENV_FILE=".env"
DOCKER_COMPOSE_FILE="docker-compose.yml"
DOCKER_COMPOSE_URL="https://raw.githubusercontent.com/dastyare-social/DS-CS/main/docker-compose.yml"

info() {
  printf '\033[1;34m%s\033[0m\n' "$*"
}

warn() {
  printf '\033[1;33m%s\033[0m\n' "$*"
}

error() {
  printf '\033[1;31m%s\033[0m\n' "$*"
  exit 1
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import secrets; print(secrets.token_hex(32))'
  else
    error "Either openssl or python3 is required to generate secrets."
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  error "Docker is required for the install script. Install Docker and rerun this script."
fi

if ! command -v curl >/dev/null 2>&1; then
  error "curl is required for the install script. Install curl and rerun this script."
fi

if [ "$APP_DIR" != "." ]; then
  mkdir -p "$APP_DIR"
  cd "$APP_DIR"
fi

if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
  info "Downloading docker-compose.yml..."
  curl -fsSL "$DOCKER_COMPOSE_URL" -o "$DOCKER_COMPOSE_FILE"
fi

if [ ! -f "$ENV_FILE" ]; then
  info "Creating a .env file with safe defaults for Docker Compose..."
  cat > "$ENV_FILE" <<EOF
DATABASE_URL="postgresql://postgres:postgres@db:5432/ds_cs"
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
API_KEY=$(generate_secret)
API_KEY_RATE_LIMIT_MAX_REQUESTS=30
API_KEY_RATE_LIMIT_WINDOW_MS=60000
BETTER_AUTH_URL="http://localhost:8729"
BETTER_AUTH_SECRET=$(generate_secret)
NEXT_PUBLIC_APP_URL="http://localhost:8729"
S3_ENDPOINT="http://rustfs:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="442c201224d92fbd5df5aa9d"
S3_SECRET_ACCESS_KEY="ea8d22810ade922c73ada6bc0c446c5de465db49454c02b8"
S3_BUCKET_NAME="ds-cs"
S3_FORCE_PATH_STYLE=true
NEXT_PUBLIC_ANIMATED_EMOJIES=false
DS_SH_URL=
DS_SH_API_KEY=
NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY=""
WEBPUSH_PRIVATE_KEY=""
WEBPUSH_SUBJECT="mailto:you@example.com"
EOF
  warn "A .env file was created. Review and update its values before using this in production."
else
  info ".env already exists, leaving it intact."
fi

info "Starting the app with Docker Compose (pulls the prebuilt dastyaresocial/ds-cs image)..."
info "The compose project is pinned to \"ds-cs\", so containers/volumes are prefixed ds-cs- regardless of the install directory."
docker compose -f "$DOCKER_COMPOSE_FILE" up -d

info "Installation complete."
info "Open http://localhost:8729 after Docker Compose finishes starting the services."
warn "Review .env and update secrets before using this in production."