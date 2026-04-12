'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const quickRepService = require('../services/quickRepService');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const QUICK_REP_TEMPLATES = [
  { name: '20 pushups', category: 'physical' },
  { name: 'Read 15 min', category: 'learning' },
  { name: 'Drink water', category: 'health' },
  { name: 'Stretch 5 min', category: 'physical' },
  { name: 'Write in journal', category: 'reflection' },
  { name: 'Help a classmate', category: 'social' },
  { name: 'Tidy workspace', category: 'agency' },
  { name: 'Practice breathing', category: 'wellbeing' },
];

const logSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
});

// GET /quick-reps/templates — List available quick rep types
router.get('/templates', auth, (req, res) => {
  res.json({ templates: QUICK_REP_TEMPLATES });
});

// GET /quick-reps/me/week — User's reps this week + cap info
router.get('/me/week', auth, async (req, res, next) => {
  try {
    const count = await quickRepService.getWeeklyCount(req.user.sub);
    res.json({
      weeklyCount: count,
      weeklyCap: quickRepService.QUICK_REP_WEEKLY_CAP,
      weeklyRemaining: Math.max(0, quickRepService.QUICK_REP_WEEKLY_CAP - count),
    });
  } catch (err) {
    next(err);
  }
});

// POST /quick-reps — Log a quick rep
router.post('/', auth, validate(logSchema), async (req, res, next) => {
  try {
    const result = await quickRepService.logQuickRep(req.user.sub, req.body.name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
