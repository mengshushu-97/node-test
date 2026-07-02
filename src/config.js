'use strict';

function numberFromEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig(env = process.env) {
  return {
    serviceName: env.SERVICE_NAME || env.OTEL_SERVICE_NAME || 'node-test',
    appEnv: env.APP_ENV || env.NODE_ENV || 'local',
    port: numberFromEnv(env.PORT, 3000),
    javaServiceUrl: env.JAVA_SERVICE_URL || 'http://localhost:8080',
    agentServiceUrl: env.AGENT_SERVICE_URL || 'http://localhost:8000',
    requestTimeoutMs: numberFromEnv(env.REQUEST_TIMEOUT_MS, 5000),
    heartbeatIntervalMs: numberFromEnv(env.HEARTBEAT_INTERVAL_MS, 1000),
    chainIntervalMs: numberFromEnv(env.CHAIN_INTERVAL_MS, 60000),
  };
}

module.exports = { getConfig };
