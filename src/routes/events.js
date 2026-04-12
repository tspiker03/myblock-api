'use strict';

const express = require('express');
const router = express.Router();

const eventService = require('../services/eventService');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// GET /events/active — Get current user's active block event
router.get('/active', auth, async (req, res, next) => {
  try {
    const { Block, BlockEvent } = require('../models');
    const block = await Block.findOne({ userId: req.user.sub });
    if (!block || !block.activeEventId) {
      return res.json({ event: null });
    }
    const event = await BlockEvent.findById(block.activeEventId);
    res.json({ event: event || null });
  } catch (err) {
    next(err);
  }
});

// POST /events/resolve/:eventId — Attempt to resolve active event
router.post('/resolve/:eventId', auth, async (req, res, next) => {
  try {
    const result = await eventService.resolveEvent(req.user.sub, req.params.eventId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /events/assign-weekly — Admin/facilitator trigger for weekly event assignment
router.post('/assign-weekly', auth, authorize('admin', 'facilitator'), async (req, res, next) => {
  try {
    const result = await eventService.assignWeeklyEvents();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /events/apply-unresolved — Admin/facilitator trigger for end-of-week impact
router.post(
  '/apply-unresolved',
  auth,
  authorize('admin', 'facilitator'),
  async (req, res, next) => {
    try {
      const result = await eventService.applyUnresolvedEvents();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
