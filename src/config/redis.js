'use strict';

const Redis = require('ioredis');
const config = require('./env');
const logger = require('../utils/logger');

let client = null;

function getClient() {
  if (client) return client;

  try {
    client = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis unavailable, continuing without Redis');
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      },
      enableOfflineQueue: false,
    });

    client.on('connect', () => logger.info('Redis connected'));
    client.on('error', (err) => logger.warn('Redis error', { error: err.message }));

    client.connect().catch(() => {
      // Non-fatal — Redis features degrade gracefully
    });
  } catch (err) {
    logger.warn('Redis client creation failed', { error: err.message });
  }

  return client;
}

module.exports = { getClient };
