#!/usr/bin/env sh
set -eu

APP_NAME="${APP_NAME:?APP_NAME is required}"
CONTAINER_NAME="${CONTAINER_NAME:-$APP_NAME}"
NAMESPACE="${NAMESPACE:-test}"
MANIFEST_DIR="${MANIFEST_DIR:-k8s/test}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short=12 HEAD)}"
IMAGE="${APP_NAME}:${IMAGE_TAG}"
KUBECTL="${KUBECTL:-kubectl}"
K3S_BIN="${K3S_BIN:-k3s}"
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-180s}"
IMAGE_TAR="${TMPDIR:-/tmp}/${APP_NAME}-${IMAGE_TAG}.tar"

cleanup() {
  rm -f "$IMAGE_TAR"
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

import_image() {
  if [ "$(id -u)" -eq 0 ]; then
    "$K3S_BIN" ctr -n k8s.io images import "$IMAGE_TAR"
  else
    sudo -n "$K3S_BIN" ctr -n k8s.io images import "$IMAGE_TAR"
  fi
}

require_command docker
require_command "$KUBECTL"
require_command "$K3S_BIN"

echo "Building image: $IMAGE"
docker build -t "$IMAGE" .

echo "Exporting image: $IMAGE_TAR"
docker save "$IMAGE" -o "$IMAGE_TAR"

echo "Importing image into k3s containerd namespace k8s.io"
import_image

echo "Applying manifests from $MANIFEST_DIR"
"$KUBECTL" apply -f "$MANIFEST_DIR"

echo "Setting deployment image: $APP_NAME/$CONTAINER_NAME=$IMAGE"
"$KUBECTL" -n "$NAMESPACE" set image "deployment/$APP_NAME" "$CONTAINER_NAME=$IMAGE"
"$KUBECTL" -n "$NAMESPACE" annotate "deployment/$APP_NAME" "cicd.github.sha=$IMAGE_TAG" --overwrite
"$KUBECTL" -n "$NAMESPACE" rollout status "deployment/$APP_NAME" --timeout="$ROLLOUT_TIMEOUT"
"$KUBECTL" -n "$NAMESPACE" get pods -l "app.kubernetes.io/name=$APP_NAME" -o wide
