#!/usr/bin/env sh
set -eu

APP_NAME="${APP_NAME:?APP_NAME is required}"
HARBOR_REGISTRY="${HARBOR_REGISTRY:-harbor.local}"
HARBOR_PROJECT="${HARBOR_PROJECT:?HARBOR_PROJECT is required}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short=12 HEAD)}"
IMAGE="${HARBOR_REGISTRY}/${HARBOR_PROJECT}/${APP_NAME}:${IMAGE_TAG}"
CACHE_IMAGE="${HARBOR_REGISTRY}/${HARBOR_PROJECT}/${APP_NAME}:buildcache"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

require_command docker

if [ "${REQUIRE_HARBOR_LOGIN:-false}" = "true" ] && { [ -z "${HARBOR_USERNAME:-}" ] || [ -z "${HARBOR_PASSWORD:-}" ]; }; then
  echo "HARBOR_USERNAME and HARBOR_PASSWORD are required" >&2
  exit 1
fi

if [ -n "${HARBOR_USERNAME:-}" ] || [ -n "${HARBOR_PASSWORD:-}" ]; then
  if [ -z "${HARBOR_USERNAME:-}" ] || [ -z "${HARBOR_PASSWORD:-}" ]; then
    echo "HARBOR_USERNAME and HARBOR_PASSWORD must be set together" >&2
    exit 1
  fi
  echo "$HARBOR_PASSWORD" | docker login "$HARBOR_REGISTRY" -u "$HARBOR_USERNAME" --password-stdin
fi

echo "Building image: $IMAGE"
docker pull "$CACHE_IMAGE" >/dev/null 2>&1 || true
docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --cache-from "$CACHE_IMAGE" \
  -t "$IMAGE" \
  -t "$CACHE_IMAGE" \
  .

echo "Pushing image: $IMAGE"
docker push "$IMAGE"

echo "Pushing build cache: $CACHE_IMAGE"
docker push "$CACHE_IMAGE" >/dev/null || echo "Warning: failed to push build cache $CACHE_IMAGE" >&2

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "image=$IMAGE" >> "$GITHUB_OUTPUT"
fi

echo "$IMAGE"
