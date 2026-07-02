'use strict';

const crypto = require('node:crypto');
const express = require('express');

const { getConfig } = require('./config');
const { createAgentClient, createJavaClient } = require('./httpClient');
const logger = require('./logger');
const { sanitize } = require('./payloadSanitizer');

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function requestIdFrom(req) {
  return req.body && req.body.requestId ? req.body.requestId : crypto.randomUUID();
}

function createApp(dependencies = {}) {
  const config = dependencies.config || getConfig();
  const javaClient = dependencies.javaClient || createJavaClient(config);
  const agentClient = dependencies.agentClient || createAgentClient(config);
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    let responseBody;

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    const originalSend = res.send.bind(res);
    res.send = (body) => {
      if (responseBody === undefined) {
        responseBody = body;
      }
      return originalSend(body);
    };

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info('http.request', 'request completed', {
        method: req.method,
        path: req.path,
        query: sanitize(req.query),
        requestBody: sanitize(req.body),
        responseBody: sanitize(responseBody),
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      });
    });
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({
      service: config.serviceName,
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/data', (_req, res) => {
    res.json({
      source: config.serviceName,
      value: 'node-data',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/java-chain', asyncHandler(async (req, res) => {
    const requestId = requestIdFrom(req);
    logger.info('chain.received', 'java requested node to call agent', {
      requestId,
      chain: 'java->node->agent',
    });

    const agent = await agentClient.process({
      requestId,
      source: config.serviceName,
      parent: req.body,
      chain: 'java->node->agent',
    });

    res.json({
      source: config.serviceName,
      chain: 'java->node->agent',
      requestId,
      agent,
      timestamp: new Date().toISOString(),
    });
  }));

  app.post('/api/trigger/node-chain', asyncHandler(async (req, res) => {
    const requestId = requestIdFrom(req);
    logger.info('chain.start', 'node starts node->java->agent chain', {
      requestId,
      chain: 'node->java->agent',
    });

    const java = await javaClient.nodeChain({
      requestId,
      source: config.serviceName,
      chain: 'node->java->agent',
    });

    res.json({
      source: config.serviceName,
      chain: 'node->java->agent',
      requestId,
      java,
      timestamp: new Date().toISOString(),
    });
  }));

  app.post('/api/trigger/node-simple', asyncHandler(async (req, res) => {
    const requestId = requestIdFrom(req);
    logger.info('chain.start', 'node starts node->java chain', {
      requestId,
      chain: 'node->java',
    });

    const java = await javaClient.nodeSimple({
      requestId,
      source: config.serviceName,
      chain: 'node->java',
    });

    res.json({
      source: config.serviceName,
      chain: 'node->java',
      requestId,
      java,
      timestamp: new Date().toISOString(),
    });
  }));

  app.use((error, req, res, _next) => {
    logger.error('http.error', 'request failed', {
      method: req.method,
      path: req.path,
      statusCode: error.status || 500,
      error,
    });
    res.status(error.status || 500).json({
      service: config.serviceName,
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

module.exports = { createApp };
