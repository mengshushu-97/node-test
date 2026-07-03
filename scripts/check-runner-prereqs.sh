#!/usr/bin/env sh
set -u

PASS=0
WARN=0
FAIL=0

pass() {
  PASS=$((PASS + 1))
  echo "[PASS] $*"
}

warn() {
  WARN=$((WARN + 1))
  echo "[WARN] $*"
}

fail() {
  FAIL=$((FAIL + 1))
  echo "[FAIL] $*"
}

need_command() {
  if command -v "$1" >/dev/null 2>&1; then
    pass "command: $1"
  else
    fail "missing command: $1"
  fi
}

KUBECTL="${KUBECTL:-kubectl}"
CHECK_NAMESPACE="${CHECK_NAMESPACE:-test}"
HARBOR_REGISTRY="${HARBOR_REGISTRY:-harbor.local}"

echo "---- RUNNER ----"
echo "User: $(id -un)"
echo "Groups: $(id -Gn)"
echo "PWD: $(pwd)"

echo "---- COMMANDS ----"
need_command git
need_command docker
need_command curl
need_command python3
need_command "$KUBECTL"

echo "---- DOCKER ----"
if command -v docker >/dev/null 2>&1; then
  if docker ps >/dev/null 2>&1; then
    pass "docker accessible"
  else
    fail "docker is not accessible by current user"
  fi

  if docker info >/dev/null 2>&1; then
    pass "docker daemon reachable"
  else
    fail "docker daemon is not reachable"
  fi

  DOCKER_CONFIG_FILE="${DOCKER_CONFIG:-$HOME/.docker}/config.json"
  if [ -f "$DOCKER_CONFIG_FILE" ] && grep -q "\"$HARBOR_REGISTRY\"" "$DOCKER_CONFIG_FILE"; then
    pass "docker has local login config for $HARBOR_REGISTRY"
  else
    fail "docker local login config missing for $HARBOR_REGISTRY; run docker login as the runner user"
  fi
fi

echo "---- KUBECTL ----"
if command -v "$KUBECTL" >/dev/null 2>&1; then
  if "$KUBECTL" get nodes >/dev/null 2>&1; then
    pass "kubectl can access cluster"
  else
    fail "kubectl cannot access cluster"
  fi

  if "$KUBECTL" get namespace "$CHECK_NAMESPACE" >/dev/null 2>&1; then
    pass "namespace $CHECK_NAMESPACE exists"
  else
    fail "namespace $CHECK_NAMESPACE does not exist; create it before Argo CD sync"
  fi

  if "$KUBECTL" get secret harbor-auth -n "$CHECK_NAMESPACE" >/dev/null 2>&1; then
    pass "secret harbor-auth exists in namespace $CHECK_NAMESPACE"
  else
    fail "secret harbor-auth missing in namespace $CHECK_NAMESPACE"
  fi
fi

echo "---- HARBOR ----"
if command -v curl >/dev/null 2>&1; then
  HARBOR_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "http://${HARBOR_REGISTRY}/v2/" || true)"
  if [ "$HARBOR_CODE" = "200" ] || [ "$HARBOR_CODE" = "401" ]; then
    pass "harbor registry reachable: $HARBOR_REGISTRY"
  else
    fail "harbor registry unreachable: $HARBOR_REGISTRY http_status=$HARBOR_CODE"
  fi
fi

echo "---- WORKFLOW LABELS ----"
echo "Test workflow labels: self-hosted, k3s, test"
echo "Prod workflow labels: self-hosted, k3s, prod"

echo "---- SUMMARY ----"
echo "PASS=$PASS WARN=$WARN FAIL=$FAIL"

[ "$FAIL" -eq 0 ]
