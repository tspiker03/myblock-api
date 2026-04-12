'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const { User } = require('../models');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const updateMeSchema = Joi.object({
  displayName: Joi.string().min(1).max(50),
  avatar: Joi.object({
    spriteKey: Joi.string(),
    equippedSkinId: Joi.string().allow(null),
  }),
  notificationPreferences: Joi.object().unknown(true),
}).min(1);

// GET /me
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('-passwordHash -parentConsentToken');
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PATCH /me
router.patch('/me', auth, validate(updateMeSchema), async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.displayName) updates.displayName = req.body.displayName;
    if (req.body.avatar) {
      if (req.body.avatar.spriteKey) updates['avatar.spriteKey'] = req.body.avatar.spriteKey;
      if (req.body.avatar.equippedSkinId !== undefined) {
        updates['avatar.equippedSkinId'] = req.body.avatar.equippedSkinId;
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.sub,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash -parentConsentToken');

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
