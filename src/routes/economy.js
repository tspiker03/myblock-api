'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const { User } = require('../models');
const economyService = require('../services/economyService');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { NotFoundError } = require('../utils/errors');
const { PILLARS } = require('../utils/constants');

const giftSchema = Joi.object({
  recipientId: Joi.string().hex().length(24).required(),
  pillar: Joi.string().valid(...PILLARS).required(),
  amount: Joi.number().integer().min(1).required(),
});

// POST /economy/gift — Gift pillar points to a teammate
router.post('/gift', auth, validate(giftSchema), async (req, res, next) => {
  try {
    const { recipientId, pillar, amount } = req.body;
    const result = await economyService.giftPoints(req.user.sub, recipientId, pillar, amount);
    res.json({ gift: result });
  } catch (err) {
    next(err);
  }
});

// GET /economy/balances — Current user's full balance breakdown
router.get('/balances', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('balances');
    if (!user) throw new NotFoundError('User not found');
    res.json({ balances: user.balances });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
