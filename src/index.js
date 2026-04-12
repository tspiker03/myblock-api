'use strict';

// Load env first — before any other module reads process.env
const config = require('./config/env');

const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const { Server: SocketIO } = require('socket.io');

const db = require('./config/database');
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
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

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
}

module.exports = { app, server };
