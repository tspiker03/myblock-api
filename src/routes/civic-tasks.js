'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const civicTaskService = require('../services/civicTaskService');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const completeSchema = Joi.object({
  civicTaskId: Joi.string().hex().length(24).required(),
  targetBlockUserId: Joi.string().hex().length(24).required(),
});

// GET /civic-tasks/available/:blockUserId — Tasks available on a block (respawn filtered)
router.get('/available/:blockUserId', auth, async (req, res, next) => {
  try {
    const tasks = await civicTaskService.getAvailableTasks(
      req.user.sub,
      req.params.blockUserId
    );
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

// POST /civic-tasks/complete — Complete a civic task on a block
router.post('/complete', auth, validate(completeSchema), async (req, res, next) => {
  try {
    const { civicTaskId, targetBlockUserId } = req.body;
    const result = await civicTaskService.completeCivicTask(
      req.user.sub,
      civicTaskId,
      targetBlockUserId
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
