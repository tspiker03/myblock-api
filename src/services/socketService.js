'use strict';

const logger = require('../utils/logger');

let _io = null;

function init(io) {
  _io = io;

  // Attempt to attach Redis adapter — fall through to in-memory if unavailable
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');
    const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.io Redis adapter attached');
      })
      .catch((err) => {
        logger.warn('Redis adapter unavailable, using in-memory', { error: err.message });
      });
  } catch (_err) {
    logger.warn('Redis adapter packages not installed, using in-memory socket transport');
  }

  io.on('connection', (socket) => {
    const { userId, teamId, classroomId, schoolId } = socket.handshake.auth;

    if (userId) socket.join(`user:${userId}`);
    if (teamId) socket.join(`team:${teamId}`);
    if (classroomId) socket.join(`classroom:${classroomId}`);
    if (schoolId) socket.join(`school:${schoolId}`);

    logger.info('Socket connected with rooms', {
      socketId: socket.id,
      userId,
      teamId,
      classroomId,
      schoolId,
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { socketId: socket.id });
    });
  });
}

function broadcastFeedEntry(entry) {
  if (!_io) return;

  if (entry.visibility === 'team' && entry.teamId) {
    _io.to(`team:${entry.teamId}`).emit('feed:new_entry', entry);
  } else if (entry.visibility === 'classroom' && entry.classroomId) {
    _io.to(`classroom:${entry.classroomId}`).emit('feed:new_entry', entry);
  } else if (entry.visibility === 'school' && entry.schoolId) {
    _io.to(`school:${entry.schoolId}`).emit('feed:new_entry', entry);
  }
}

function broadcastLeaderboardUpdate(scope, scopeId, leaderboard) {
  if (!_io) return;
  _io.to(`${scope}:${scopeId}`).emit('leaderboard:update', leaderboard);
}

function broadcastBlockEvent(userId, event) {
  if (!_io) return;
  _io.to(`user:${userId}`).emit('block:event_assigned', event);
}

module.exports = { init, broadcastFeedEntry, broadcastLeaderboardUpdate, broadcastBlockEvent };
