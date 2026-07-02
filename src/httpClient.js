'use strict';

let otel;
try {
  otel = require('@opentelemetry/api');
} catch (_error) {
  otel = undefined;
}

function injectTraceHeaders(headers) {
  if (!otel) {
    return headers;
  }
  otel.propagation.inject(otel.context.active(), headers);
  return headers;
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 5000);
  const headers = injectTraceHeaders({
    accept: 'application/json',
    'content-type': 'application/json',
    ...(options.headers || {}),
  });

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} from ${url}`);
      error.status = response.status;
      error.response = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function createJavaClient(config) {
  return {
    nodeChain(payload) {
      return requestJson(`${config.javaServiceUrl}/api/node-chain`, {
        method: 'POST',
        body: payload,
        timeoutMs: config.requestTimeoutMs,
      });
    },
    nodeSimple(payload) {
      return requestJson(`${config.javaServiceUrl}/api/node-simple`, {
        method: 'POST',
        body: payload,
        timeoutMs: config.requestTimeoutMs,
      });
    },
  };
}

function createAgentClient(config) {
  return {
    process(payload) {
      return requestJson(`${config.agentServiceUrl}/api/process`, {
        method: 'POST',
        body: payload,
        timeoutMs: config.requestTimeoutMs,
      });
    },
  };
}

module.exports = {
  createAgentClient,
  createJavaClient,
  requestJson,
};
