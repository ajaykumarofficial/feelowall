#!/usr/bin/env bash
#
# Runs ON the EC2 instance (sent by GitHub Actions through SSM Run Command, as root).
# Pulls the new image from ECR, swaps the running container, checks /health, and
# rolls back to the previous container if the new one doesn't become healthy.
#
#   ec2-deploy.sh <image-uri> <aws-region> <ssm-env-parameter-name>
#
# Requirements on the instance:
#   - Docker and the AWS CLI (both preinstalled or installed below on Amazon Linux 2023)
#   - IAM instance role with: AmazonSSMManagedInstanceCore, AmazonEC2ContainerRegistryReadOnly,
#     ssm:GetParameter on the env parameter, and s3:PutObject/DeleteObject on the wallpaper bucket
set -euo pipefail

IMAGE_URI="$1"
AWS_REGION="$2"
ENV_PARAMETER="$3"

APP_NAME="aerowell"
APP_DIR="/opt/${APP_NAME}"
ENV_FILE="${APP_DIR}/.env"
HOST_PORT=80
CONTAINER_PORT=5000
HEALTH_TIMEOUT_SECONDS=90

REGISTRY="${IMAGE_URI%%/*}"

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }

# Package installs must never stop to ask questions (there's no terminal under SSM)
export DEBIAN_FRONTEND=noninteractive

# ---------- AWS CLI (preinstalled on Amazon Linux, not on Ubuntu) ----------
if ! command -v aws >/dev/null 2>&1; then
  log "AWS CLI not found, installing v2"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y -qq && apt-get install -y -qq unzip curl >/dev/null
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q unzip curl
  fi
  case "$(uname -m)" in
    aarch64|arm64) CLI_ARCH=aarch64 ;;
    *)             CLI_ARCH=x86_64 ;;
  esac
  TMP_CLI="$(mktemp -d)"
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${CLI_ARCH}.zip" -o "${TMP_CLI}/awscliv2.zip"
  unzip -q "${TMP_CLI}/awscliv2.zip" -d "${TMP_CLI}"
  "${TMP_CLI}/aws/install" --update
  rm -rf "${TMP_CLI}"
  hash -r
  aws --version
fi

# ---------- Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  log "Docker not found, installing"
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y docker
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -y -qq && apt-get install -y -qq docker.io curl >/dev/null
  else
    log "No supported package manager to install Docker"; exit 1
  fi
  systemctl enable --now docker
fi
systemctl is-active --quiet docker || systemctl start docker

# ---------- Environment (secrets live in SSM Parameter Store, never in GitHub or the image) ----------
mkdir -p "${APP_DIR}/uploads"
chown 1000:1000 "${APP_DIR}/uploads"   # the image runs as the "node" user (uid 1000)

log "Fetching environment from SSM parameter ${ENV_PARAMETER}"
umask 077
aws ssm get-parameter \
  --region "${AWS_REGION}" \
  --name "${ENV_PARAMETER}" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text > "${ENV_FILE}.new"
mv "${ENV_FILE}.new" "${ENV_FILE}"
umask 022

# ---------- Pull ----------
log "Logging in to ${REGISTRY}"
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${REGISTRY}"

log "Pulling ${IMAGE_URI}"
docker pull "${IMAGE_URI}"

# ---------- Swap ----------
run_container() {
  docker run -d \
    --name "${APP_NAME}" \
    --restart unless-stopped \
    --env-file "${ENV_FILE}" \
    -e NODE_ENV=production \
    -e PORT="${CONTAINER_PORT}" \
    -p "${HOST_PORT}:${CONTAINER_PORT}" \
    -v "${APP_DIR}/uploads:/app/backend/uploads" \
    --log-driver json-file \
    --log-opt max-size=20m \
    --log-opt max-file=5 \
    "$1"
}

wait_healthy() {
  local deadline=$(( $(date +%s) + HEALTH_TIMEOUT_SECONDS ))
  while [ "$(date +%s)" -lt "${deadline}" ]; do
    if curl -fsS -o /dev/null "http://127.0.0.1:${HOST_PORT}/health"; then
      return 0
    fi
    sleep 3
  done
  return 1
}

PREVIOUS_IMAGE=""
if docker container inspect "${APP_NAME}" >/dev/null 2>&1; then
  PREVIOUS_IMAGE="$(docker container inspect --format '{{.Config.Image}}' "${APP_NAME}")"
  log "Stopping current container (${PREVIOUS_IMAGE})"
  docker rm -f "${APP_NAME}-previous" >/dev/null 2>&1 || true
  docker stop --time 20 "${APP_NAME}"
  docker rename "${APP_NAME}" "${APP_NAME}-previous"
fi

log "Starting ${IMAGE_URI}"
run_container "${IMAGE_URI}"

if wait_healthy; then
  log "New container is healthy"
  docker rm -f "${APP_NAME}-previous" >/dev/null 2>&1 || true
  # Keep the last few images for manual rollback, drop the rest
  docker image prune -af --filter "until=168h" >/dev/null || true
  log "Deploy finished"
  exit 0
fi

log "New container failed its health check. Last log lines:"
docker logs --tail 80 "${APP_NAME}" || true
docker rm -f "${APP_NAME}" >/dev/null 2>&1 || true

if [ -n "${PREVIOUS_IMAGE}" ]; then
  log "Rolling back to ${PREVIOUS_IMAGE}"
  docker rename "${APP_NAME}-previous" "${APP_NAME}"
  docker start "${APP_NAME}"
  wait_healthy && log "Rollback is healthy" || log "Rollback container is not healthy either"
fi
exit 1
