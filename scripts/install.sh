#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${1:-"."}
ENV_FILE=".env"
DOCKER_COMPOSE_FILE="docker-compose.yml"
DOCKER_COMPOSE_URL="https://raw.githubusercontent.com/dastyare-social/DS-CS/main/docker-compose.yml"
BASE_URL="https://raw.githubusercontent.com/dastyare-social/DS-CS/main"

# Editable assets the installer drops into the project so the app is your own:
# the brand config files and the profile image shown on /about. For binary
# assets the repo path differs from the local destination: the default avatar
# lives at defaults/ in the repo (so a source checkout has no public/
# profile-image.png shadowing the route), but installed folders keep it at
# public/profile-image.png (bind-mounted to /app/brand in the container).
CONFIG_FILES=(
  "config/app.config.yml"
  "config/about.config.yml"
)
BINARY_FILES=(
  "defaults/profile-image.png|public/profile-image.png"
)
# A pull-only Vercel blueprint (FROM dastyaresocial/ds-cs:latest + PORT-aware
# CMD) dropped at the project root so the installed folder can be deployed to
# Vercel Fluid compute without touching the app source repo.
VERCEL_FILES=(
  "Dockerfile.vercel"
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

# Interactive answers come from the controlling terminal: under `curl ... | bash`
# the script's stdin is the download pipe (already at EOF), so a plain `read`
# would see an empty value. Prefer /dev/tty when one is attached, else stdin.
# The password is hidden with `stty -echo` rather than `read -s` because macOS
# ships bash 3.2, where `read -s -p` fails to disable echo (the password would
# be printed in plain text as it is typed).
restore_echo() {
  stty echo < /dev/tty 2>/dev/null || true
  stty echo 2>/dev/null || true
}

if [ ! -f "$ENV_FILE" ]; then
  printf '\033[1;36m--- Dastyare Social — CS — INSTALLER ---\033[0m\n'

  if [ -r /dev/tty ] 2>/dev/null; then
    trap restore_echo EXIT INT TERM
    printf '%s' "Email:    "
    read -r ADMIN_EMAIL < /dev/tty || true
    stty -echo < /dev/tty
    printf '%s' "Password: "
    read -r ADMIN_PASSWORD < /dev/tty || true
    printf '\n'
    stty echo < /dev/tty
  elif [ -t 0 ]; then
    printf '%s' "Email:    "
    read -r ADMIN_EMAIL || true
    stty -echo
    printf '%s' "Password: "
    read -r ADMIN_PASSWORD || true
    printf '\n'
    stty echo
  else
    printf '%s' "Email:    "
    read -r ADMIN_EMAIL || true
    printf '%s' "Password: "
    read -r ADMIN_PASSWORD || true
    printf '\n'
  fi

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

for CONFIG_FILE in "${CONFIG_FILES[@]}"; do
  if [ -f "$CONFIG_FILE" ]; then
    info "$CONFIG_FILE already exists, leaving it intact."
  else
    info "Downloading $CONFIG_FILE (edit this file to change how your channel looks)..."
    mkdir -p "$(dirname "$CONFIG_FILE")"
    curl -fsSL "$BASE_URL/$CONFIG_FILE" -o "$CONFIG_FILE"
  fi
done

for BINARY_MAP in "${BINARY_FILES[@]}"; do
  SOURCE_FILE="${BINARY_MAP%%|*}"
  DEST_FILE="${BINARY_MAP##*|}"
  if [ -f "$DEST_FILE" ]; then
    info "$DEST_FILE already exists, leaving it intact."
  else
    info "Downloading $DEST_FILE (edit this file to change how your channel looks)..."
    mkdir -p "$(dirname "$DEST_FILE")"
    curl -fsSL "$BASE_URL/$SOURCE_FILE" -o "$DEST_FILE"
  fi
done

for FILE in "${VERCEL_FILES[@]}"; do
  if [ -f "$FILE" ]; then
    info "$FILE already exists, leaving it intact."
  else
    info "Downloading $FILE (use it to deploy this folder to Vercel Fluid compute)..."
    mkdir -p "$(dirname "$FILE")"
    curl -fsSL "$BASE_URL/$FILE" -o "$FILE"
  fi
done

info "Starting the app with Docker Compose (pulls the latest prebuilt dastyaresocial/ds-cs image)..."
info "The compose project is pinned to \"ds-cs\", so containers/volumes are prefixed ds-cs- regardless of the install directory."
docker compose -f "$DOCKER_COMPOSE_FILE" pull
docker compose -f "$DOCKER_COMPOSE_FILE" up -d

info "Installation complete."
info "Open http://localhost:8729 after Docker Compose finishes starting the services."
info "Make this channel yours: edit config/app.config.yml, config/about.config.yml"
info "and public/profile-image.png, then reload the page — no rebuild or restart needed."
warn "Review .env and update secrets before using this in production."
