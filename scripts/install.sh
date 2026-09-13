#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${1:-"."}
ENV_FILE=".env"
DOCKER_COMPOSE_FILE="docker-compose.yml"
DOCKER_COMPOSE_URL="https://raw.githubusercontent.com/dastyare-social/DS-CS/main/docker-compose.yml"
BASE_URL="https://raw.githubusercontent.com/dastyare-social/DS-CS/main"

# Editable assets the installer drops into the project so the app is your own:
# the brand config files and the profile image shown on /about.
CONFIG_FILES=(
  "config/app.config.yml"
  "config/about.config.yml"
)
BINARY_FILES=(
  "public/profile-image.png"
)

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

# Generate a VAPID key pair (EC P-256, uncompressed point) via Node's built-in
# crypto module — no external dependencies needed. The public key includes the
# 0x04 prefix (65 bytes), matching the format `npx web-push generate-vapid-keys` emits.
generate_vapid_keys() {
  if ! command -v node >/dev/null 2>&1; then
    error "Node.js is required to generate VAPID keys. Install Node and rerun this script."
  fi
  node <<'NODE'
const { createECDH } = require("crypto");
const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const pub = ecdh.getPublicKey().toString("base64url");
const priv = ecdh.getPrivateKey().toString("base64url");
console.log(pub + " " + priv);
NODE
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
  printf '\033[1;36m--- Dastyare Social Installer ---\033[0m\n'
  read -r -p "Email:    " ADMIN_EMAIL
  read -r -s -p "Password: " ADMIN_PASSWORD && printf '\n'

  if [ -z "$ADMIN_EMAIL" ]; then
    error "Email cannot be empty."
  fi

  if [ -z "$ADMIN_PASSWORD" ]; then
    error "Password cannot be empty."
  fi

  read -r VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY <<< "$(generate_vapid_keys)"

  info "Creating .env..."
  cat > "$ENV_FILE" <<EOF
DATABASE_URL="postgresql://postgres:postgres@db:5432/ds_cs"
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
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
# Browser-reachable base for media URLs. Port 9000 is mapped to rustfs on the
# host; keep this in sync with docker-compose.yml's rustfs ports.
S3_PUBLIC_BASE_URL="http://localhost:9000/ds-cs"
NEXT_PUBLIC_ANIMATED_EMOJIES=false
DS_SH_URL=
DS_SH_API_KEY=
NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY=$VAPID_PUBLIC_KEY
WEBPUSH_PRIVATE_KEY=$VAPID_PRIVATE_KEY
WEBPUSH_SUBJECT="mailto:$ADMIN_EMAIL"
EOF
  warn "A .env file was created with your credentials and auto-generated secrets."
else
  info ".env already exists, leaving it intact."
fi

for FILE in "${CONFIG_FILES[@]}" "${BINARY_FILES[@]}"; do
  if [ -f "$FILE" ]; then
    info "$FILE already exists, leaving it intact."
  else
    info "Downloading $FILE (edit this file to change how your channel looks)..." 
    mkdir -p "$(dirname "$FILE")"
    curl -fsSL "$BASE_URL/$FILE" -o "$FILE"
  fi
done

info "Starting the app with Docker Compose (pulls the prebuilt dastyaresocial/ds-cs image)..."
info "The compose project is pinned to \"ds-cs\", so containers/volumes are prefixed ds-cs- regardless of the install directory."
docker compose -f "$DOCKER_COMPOSE_FILE" up -d

info "Installation complete."
info "Open http://localhost:8729 after Docker Compose finishes starting the services."
info "Make this channel yours: edit config/app.config.yml, config/about.config.yml"
info "and public/profile-image.png, then reload the page — no rebuild or restart needed."
warn "Review .env and update secrets before using this in production."
