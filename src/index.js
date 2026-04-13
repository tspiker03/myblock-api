'use strict';

// Load env first — before any other module reads process.env
const config = require('./config/env');

const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const { Server: SocketIO } = require('socket.io');

const mongoose = require('mongoose');
const db = require('./config/database');
const redis = require('./config/redis');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const socketService = require('./services/socketService');

const app = express();
const server = http.createServer(app);

// Socket.io — initialize with room management and optional Redis adapter
const io = new SocketIO(server, {
  cors: { origin: '*' },
});
socketService.init(io);
app.set('io', io);

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());
app.use(generalLimiter);

// Health check
app.get('/health', async (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;

  let redisReady = false;
  try {
    const redisClient = redis.getClient();
    if (redisClient) {
      await redisClient.ping();
      redisReady = true;
    }
  } catch (_err) {
    // Redis is non-fatal — report status but don't fail
  }

  const status = mongoReady ? 'ok' : 'degraded';
  const code = mongoReady ? 200 : 503;

  res.status(code).json({
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongoReady ? 'ok' : 'down',
      redis: redisReady ? 'ok' : 'down',
    },
  });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Global error handler (must be last, 4-arg signature)
app.use(errorHandler);

// Only connect and listen when not in test mode
if (require.main === module) {
  db.connect()
    .then(() => {
      server.listen(config.port, () => {
        logger.info('MyBlock API started', { port: config.port, env: config.nodeEnv });
      });
    })
    .catch((err) => {
      logger.error('Failed to start server', { error: err.message });
      process.exit(1);
    });

  // Graceful shutdown — Docker sends SIGTERM before SIGKILL
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(async () => {
      try {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected');
        const redisClient = redis.getClient();
        if (redisClient) {
          await redisClient.quit();
          logger.info('Redis disconnected');
        }
      } catch (err) {
        logger.warn('Error during shutdown cleanup', { error: err.message });
      }
      logger.info('Process exiting');
      process.exit(0);
    });
  });
}

module.exports = { app, server };
