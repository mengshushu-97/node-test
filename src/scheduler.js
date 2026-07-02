'use strict';

const crypto = require('node:crypto');

const { createJavaClient } = require('./httpClient');
const logger = require('./logger');

function startScheduler(config, dependencies = {}) {
  const javaClient = dependencies.javaClient || createJavaClient(config);
  const timers = [];

  timers.push(setInterval(() => {
    logger.info('heartbeat', 'node service heartbeat', {
      uptimeSec: Number(process.uptime().toFixed(0)),
    });
  }, config.heartbeatIntervalMs));

  timers.push(setInterval(async () => {
    const requestId = crypto.randomUUID();
    try {
      logger.info('schedule.chain.start', 'scheduled node->java->agent call started', {
        requestId,
        chain: 'node->java->agent',
      });
      const result = await javaClient.nodeChain({
        requestId,
        source: config.serviceName,
        chain: 'node->java->agent',
      });
      logger.info('schedule.chain.success', 'scheduled node->java->agent call finished', {
        requestId,
        chain: 'node->java->agent',
        peerService: 'java-test',
        resultSource: result.source,
      });
    } catch (error) {
      logger.error('schedule.chain.error', 'scheduled node->java->agent call failed', {
        requestId,
        chain: 'node->java->agent',
        error,
      });
    }
  }, config.chainIntervalMs));

  timers.push(setInterval(async () => {
    const requestId = crypto.randomUUID();
    try {
      logger.info('schedule.chain.start', 'scheduled node->java call started', {
        requestId,
        chain: 'node->java',
      });
      const result = await javaClient.nodeSimple({
        requestId,
        source: config.serviceName,
        chain: 'node->java',
      });
      logger.info('schedule.chain.success', 'scheduled node->java call finished', {
        requestId,
        chain: 'node->java',
        peerService: 'java-test',
        resultSource: result.source,
      });
    } catch (error) {
      logger.error('schedule.chain.error', 'scheduled node->java call failed', {
        requestId,
        chain: 'node->java',
        error,
      });
    }
  }, config.chainIntervalMs));

  return () => {
    timers.forEach(clearInterval);
  };
}

module.exports = { startScheduler };
