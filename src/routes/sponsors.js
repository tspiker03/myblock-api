'use strict';

const express = require('express');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const router = express.Router();
const config = require('../config/env');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const sponsorService = require('../services/sponsorService');
const { AuthError, ForbiddenError } = require('../utils/errors');

const sponsorLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts — try again in 15 minutes' } },
});

// ---------------------------------------------------------------------------
// Sponsor JWT middleware — verifies token and asserts role === 'sponsor'
// ---------------------------------------------------------------------------
function sponsorAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AuthError('Missing or malformed Authorization header', 'MISSING_TOKEN'));
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AuthError('Token expired', 'TOKEN_EXPIRED'));
    }
    return next(new AuthError('Invalid token', 'INVALID_TOKEN'));
  }

  if (payload.role !== 'sponsor') {
    return next(new ForbiddenError('Sponsor access only'));
  }

  req.sponsor = {
    sub: payload.sub,
    school_ids: payload.school_ids || [],
    jti: payload.jti,
  };

  next();
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const registerSchema = Joi.object({
  businessName: Joi.string().trim().min(1).required(),
  contactName: Joi.string().trim().min(1).required(),
  contactEmail: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  website: Joi.string().uri().optional().allow(null, ''),
  phone: Joi.string().trim().optional().allow(null, ''),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const prizeSchema = Joi.object({
  name: Joi.string().trim().min(1).required(),
  description: Joi.string().trim().optional().allow(null, ''),
  imageUrl: Joi.string().uri().optional().allow(null, ''),
  estimatedValue: Joi.number().min(0).optional(),
  deliveryMethod: Joi.string().valid('physical_pickup', 'gift_card', 'digital').required(),
  tier: Joi.string().valid('monthly_team', 'quarterly_class', 'semester_individual').required(),
  schoolId: Joi.string().optional().allow(null, ''),
  seasonId: Joi.string().optional().allow(null, ''),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /sponsors/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const sponsor = await sponsorService.registerSponsor(req.body);
    res.status(201).json({ sponsor });
  } catch (err) {
    next(err);
  }
});

// POST /sponsors/login
router.post('/login', sponsorLoginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await sponsorService.loginSponsor(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /sponsors/dashboard — sponsor auth required
router.get('/dashboard', sponsorAuth, async (req, res, next) => {
  try {
    const dashboard = await sponsorService.getSponsorDashboard(req.sponsor.sub);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

// POST /sponsors/prizes — sponsor auth required
router.post('/prizes', sponsorAuth, validate(prizeSchema), async (req, res, next) => {
  try {
    const prize = await sponsorService.createPrize(req.sponsor.sub, req.body);
    res.status(201).json({ prize });
  } catch (err) {
    next(err);
  }
});

// GET /sponsors/prizes — sponsor auth required
router.get('/prizes', sponsorAuth, async (req, res, next) => {
  try {
    const prizes = await sponsorService.listSponsorPrizes(req.sponsor.sub);
    res.json({ prizes });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
