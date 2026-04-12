'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const { User, School } = require('../models');
const authService = require('../services/authService');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const { AuthError, NotFoundError, ValidationError } = require('../utils/errors');
const { getClient: getRedis } = require('../config/redis');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(20).required(),
  displayName: Joi.string().min(1).max(50).required(),
  password: Joi.string().min(6).required(),
  gradeLevel: Joi.number().integer().min(1).max(12).required(),
  classroomId: Joi.string().required(),
  teamId: Joi.string().optional().allow(null, ''),
  role: Joi.string().valid('student', 'facilitator').default('student'),
  email: Joi.string().email().optional().allow(null, ''),
  schoolId: Joi.string().required(),
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

// POST /register
router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { username, displayName, password, gradeLevel, classroomId, teamId, role, email, schoolId } = req.body;

    const school = await School.findById(schoolId);
    if (!school) return next(new NotFoundError('School not found'));

    const passwordHash = await authService.hashPassword(password, role);

    // COPPA: student under 13, school without DPA active -> parent consent required
    const requiresConsent = role === 'student' && gradeLevel <= 5 && !school.dpaActive;
    const consentToken = requiresConsent ? authService.generateConsentToken() : null;

    const user = await User.create({
      username,
      displayName,
      passwordHash,
      role: role || 'student',
      gradeLevel,
      classroomId,
      teamId: teamId || null,
      schoolId,
      email: email || null,
      isActive: !requiresConsent,
      parentConsentToken: consentToken,
    });

    const token = authService.generateToken(user);

    res.status(201).json({
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        schoolId: user.schoolId,
        classroomId: user.classroomId,
      },
      token,
      requiresParentConsent: requiresConsent,
      temporaryPassword: password,
    });
  } catch (err) {
    next(err);
  }
});

// POST /login
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select('+passwordHash +parentConsentToken');
    if (!user) return next(new AuthError('Invalid credentials', 'INVALID_CREDENTIALS'));

    if (authService.checkLockout(user)) {
      return next(new AuthError('Account temporarily locked due to failed login attempts', 'ACCOUNT_LOCKED'));
    }

    if (!user.isActive) {
      return next(new AuthError('Account is not active. Parent consent may be required.', 'ACCOUNT_INACTIVE'));
    }

    const valid = await authService.comparePassword(password, user.passwordHash);
    if (!valid) {
      await authService.recordFailedAttempt(user._id);
      return next(new AuthError('Invalid credentials', 'INVALID_CREDENTIALS'));
    }

    await authService.resetFailedAttempts(user._id);
    await User.findByIdAndUpdate(user._id, { lastActiveAt: new Date() });

    const token = authService.generateToken(user);
    const refreshToken = ['facilitator', 'school_admin', 'admin'].includes(user.role)
      ? authService.generateRefreshToken(user)
      : null;

    res.json({
      token,
      refreshToken,
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        schoolId: user.schoolId,
        classroomId: user.classroomId,
        teamId: user.teamId,
        avatar: user.avatar,
        balances: user.balances,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /refresh — facilitators only
router.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(new AuthError('Refresh token required', 'MISSING_TOKEN'));

    const payload = authService.verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) return next(new AuthError('User not found or inactive', 'UNAUTHORIZED'));

    const newToken = authService.generateToken(user);
    res.json({ token: newToken });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AuthError('Invalid or expired refresh token', 'INVALID_TOKEN'));
    }
    next(err);
  }
});

// POST /logout
router.post('/logout', auth, async (req, res, next) => {
  try {
    const redis = getRedis();
    if (redis && req.user.jti) {
      // Blocklist the JWT by its JTI until TTL expires (4h for students, 8h for facilitators)
      const ttl = 8 * 60 * 60;
      await redis.set(`blocklist:${req.user.jti}`, '1', 'EX', ttl).catch(() => {});
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /consent/:token
router.get('/consent/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ parentConsentToken: token }).select('+parentConsentToken');
    if (!user) return next(new NotFoundError('Consent token not found or already used'));

    user.parentConsentAt = new Date();
    user.parentConsentToken = null;
    user.isActive = true;
    await user.save();

    res.json({ message: 'Parental consent recorded. Account is now active.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
