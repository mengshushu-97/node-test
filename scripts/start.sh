#!/usr/bin/env sh
set -eu

export NODE_ENV="${NODE_ENV:-production}"
export SERVICE_NAME="${SERVICE_NAME:-node-test}"
export OTEL_SERVICE_NAME="${OTEL_SERVICE_NAME:-$SERVICE_NAME}"
export OTEL_EXPORTER_OTLP_PROTOCOL="${OTEL_EXPORTER_OTLP_PROTOCOL:-http/protobuf}"

exec node -r ./src/tracing.js src/server.js
