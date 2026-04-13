'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { User } = require('../models');

// Joi schemas

const prefsSchema = Joi.object({
  mondayLaunch: Joi.object({
    push: Joi.boolean(),
    email: Joi.boolean(),
  }),
  thursdayQueue: Joi.object({
    push: Joi.boolean(),
    email: Joi.boolean(),
  }),
  fridaySlideshow: Joi.object({
    push: Joi.boolean(),
    email: Joi.boolean(),
  }),
});

const deviceTokenSchema = Joi.object({
  token: Joi.string().min(1).required(),
});

// GET /notifications/preferences
router.get('/preferences', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('notificationPrefs').lean();
    if (!user) return next(new (require('../utils/errors').NotFoundError)('User not found'));
    res.json({ notificationPrefs: user.notificationPrefs || {} });
  } catch (err) {
    next(err);
  }
});

// PATCH /notifications/preferences
router.patch('/preferences', auth, validate(prefsSchema), async (req, res, next) => {
  try {
    const update = {};
    for (const [key, val] of Object.entries(req.body)) {
      if (val && typeof val === 'object') {
        for (const [subKey, subVal] of Object.entries(val)) {
          update[`notificationPrefs.${key}.${subKey}`] = subVal;
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.sub,
      { $set: update },
      { new: true, select: 'notificationPrefs' }
    ).lean();

    if (!user) return next(new (require('../utils/errors').NotFoundError)('User not found'));
    res.json({ notificationPrefs: user.notificationPrefs });
  } catch (err) {
    next(err);
  }
});

// POST /notifications/register-device
router.post('/register-device', auth, validate(deviceTokenSchema), async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: req.user.sub },
      { $addToSet: { fcmTokens: req.body.token } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /notifications/register-device
router.delete('/register-device', auth, validate(deviceTokenSchema), async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: req.user.sub },
      { $pull: { fcmTokens: req.body.token } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
