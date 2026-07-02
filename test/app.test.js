const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../src/app');
const logger = require('../src/logger');

async function captureInfoLogs(run) {
  const logs = [];
  const originalInfo = logger.info;
  logger.info = (event, message, fields) => {
    logs.push({ event, message, ...fields });
  };
  try {
    await run();
  } finally {
    logger.info = originalInfo;
  }
  return logs;
}

async function request(app, method, path, body) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      statusCode: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('health endpoint returns node service status', async () => {
  const app = createApp();

  const response = await request(app, 'GET', '/health');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.service, 'node-test');
  assert.equal(response.body.status, 'ok');
});

test('java chain endpoint proxies java and agent response', async () => {
  const calls = [];
  const app = createApp({
    javaClient: {
      nodeChain: async (payload) => {
        calls.push(payload);
        return {
          source: 'java-test',
          agent: { source: 'agent-test', value: 'processed' },
        };
      },
    },
  });

  const response = await request(app, 'POST', '/api/trigger/node-chain', {});

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.source, 'node-test');
  assert.equal(response.body.chain, 'node->java->agent');
  assert.equal(response.body.java.source, 'java-test');
  assert.equal(response.body.java.agent.source, 'agent-test');
  assert.equal(calls.length, 1);
});

test('http request log includes path input and output', async () => {
  const app = createApp({
    javaClient: {
      nodeSimple: async (payload) => ({
        source: 'java-test',
        received: payload,
      }),
    },
  });

  const logs = await captureInfoLogs(async () => {
    await request(app, 'POST', '/api/trigger/node-simple?debug=true', {
      requestId: 'req-log-test',
      password: 'secret-value',
    });
  });

  const httpLog = logs.find((item) => item.event === 'http.request' && item.path === '/api/trigger/node-simple');

  assert.ok(httpLog);
  assert.equal(httpLog.query.debug, 'true');
  assert.equal(httpLog.requestBody.requestId, 'req-log-test');
  assert.equal(httpLog.requestBody.password, '[REDACTED]');
  assert.equal(httpLog.responseBody.source, 'node-test');
  assert.equal(httpLog.responseBody.java.source, 'java-test');
});
