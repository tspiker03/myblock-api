'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');
const { User } = require('../models');
const { AuthError } = require('../utils/errors');

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

async function hashPassword(password, role) {
  const cost = role === 'facilitator' || role === 'school_admin' || role === 'admin' ? 12 : 10;
  return bcrypt.hash(password, cost);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken(user) {
  const isStudent = user.role === 'student';
  const expiresIn = isStudent ? '4h' : '8h';
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      school_id: user.schoolId ? String(user.schoolId) : null,
      jti: uuidv4(),
    },
    config.jwtSecret,
    { expiresIn }
  );
}

function generateRefreshToken(user) {
  // Only for facilitators and above
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      school_id: user.schoolId ? String(user.schoolId) : null,
      jti: uuidv4(),
      type: 'refresh',
    },
    config.jwtRefreshSecret,
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwtRefreshSecret);
  if (payload.type !== 'refresh') {
    throw new AuthError('Not a refresh token', 'INVALID_TOKEN');
  }
  return payload;
}

function generateConsentToken() {
  return uuidv4();
}

function checkLockout(user) {
  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    return true;
  }
  return false;
}

async function recordFailedAttempt(userId) {
  const update = { $inc: { failedLoginAttempts: 1 } };
  const user = await User.findByIdAndUpdate(userId, update, { new: true });
  if (user && user.failedLoginAttempts >= LOCKOUT_MAX_ATTEMPTS) {
    await User.findByIdAndUpdate(userId, {
      lockoutUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
    });
  }
}

async function resetFailedAttempts(userId) {
  await User.findByIdAndUpdate(userId, {
    failedLoginAttempts: 0,
    lockoutUntil: null,
  });
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  generateConsentToken,
  checkLockout,
  recordFailedAttempt,
  resetFailedAttempts,
};
