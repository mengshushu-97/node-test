'use strict';

require('./tracing');

const { createApp } = require('./app');
const { getConfig } = require('./config');
const logger = require('./logger');
const { startScheduler } = require('./scheduler');

const config = getConfig();
const app = createApp({ config });

const server = app.listen(config.port, () => {
  logger.info('service.started', 'node service started', {
    port: config.port,
    javaServiceUrl: config.javaServiceUrl,
    agentServiceUrl: config.agentServiceUrl,
  });
});

const stopScheduler = startScheduler(config);

function shutdown(signal) {
  logger.info('service.stopping', 'node service stopping', { signal });
  stopScheduler();
  server.close(() => {
    logger.info('service.stopped', 'node service stopped', { signal });
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
