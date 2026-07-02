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
K3S_BIN="${K3S_BIN:-k3s}"
CHECK_NAMESPACE="${CHECK_NAMESPACE:-test}"

echo "---- RUNNER ----"
echo "User: $(id -un)"
echo "Groups: $(id -Gn)"
echo "PWD: $(pwd)"

echo "---- COMMANDS ----"
need_command git
need_command docker
need_command "$KUBECTL"
need_command "$K3S_BIN"
need_command sudo

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
    warn "namespace $CHECK_NAMESPACE does not exist; workflow will create it from manifests"
  fi
fi

echo "---- K3S CONTAINERD ----"
if command -v "$K3S_BIN" >/dev/null 2>&1; then
  if [ "$(id -u)" -eq 0 ]; then
    if "$K3S_BIN" ctr -n k8s.io images ls >/dev/null 2>&1; then
      pass "k3s containerd namespace k8s.io accessible"
    else
      fail "k3s containerd namespace k8s.io is not accessible"
    fi
  else
    if sudo -n "$K3S_BIN" ctr -n k8s.io images ls >/dev/null 2>&1; then
      pass "sudo k3s ctr accessible without password"
    else
      fail "sudo k3s ctr requires password or is not allowed"
    fi
  fi
fi

echo "---- WORKFLOW LABELS ----"
echo "Test workflow labels: self-hosted, k3s, test"
echo "Prod workflow labels: self-hosted, k3s, prod"

echo "---- SUMMARY ----"
echo "PASS=$PASS WARN=$WARN FAIL=$FAIL"

[ "$FAIL" -eq 0 ]
