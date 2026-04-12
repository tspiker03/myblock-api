'use strict';

const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

async function connect() {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    throw err;
  }
}

mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected', { uri: config.mongoUri });
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

module.exports = { connect };
