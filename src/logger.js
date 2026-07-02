'use strict';

const { getConfig } = require('./config');

let traceApi;
try {
  traceApi = require('@opentelemetry/api').trace;
} catch (_error) {
  traceApi = { getActiveSpan: () => undefined };
}

function getTraceFields() {
  const span = traceApi.getActiveSpan();
  const spanContext = span && span.spanContext ? span.spanContext() : undefined;
  if (!spanContext) {
    return {};
  }
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

function normalizeError(error) {
  if (!error) {
    return undefined;
  }
  return {
    name: error.name,
    message: error.message,
    stack: process.env.LOG_STACK === 'true' ? error.stack : undefined,
  };
}

function write(level, event, message, fields = {}) {
  const config = getConfig();
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: config.serviceName,
    env: config.appEnv,
    event,
    message,
    ...getTraceFields(),
    ...fields,
  };

  if (payload.error instanceof Error) {
    payload.error = normalizeError(payload.error);
  }

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

module.exports = {
  debug: (event, message, fields) => write('debug', event, message, fields),
  info: (event, message, fields) => write('info', event, message, fields),
  warn: (event, message, fields) => write('warn', event, message, fields),
  error: (event, message, fields) => write('error', event, message, fields),
};
