'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const { Submission } = require('../models');
const missionService = require('../services/missionService');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { NotFoundError } = require('../utils/errors');

const rejectSchema = Joi.object({
  reason: Joi.string().min(1).max(500).required(),
});

// GET / — List submissions for current user or team
router.get('/', auth, async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.teamId) {
      filter.teamId = req.query.teamId;
    } else {
      filter.userId = req.user.sub;
    }

    if (req.query.status) filter.status = req.query.status;

    const submissions = await Submission.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ submissions });
  } catch (err) {
    next(err);
  }
});

// GET /:id — Get submission details
router.get('/:id', auth, async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('missionTemplateId', 'title description tier pillar pointValues safetyTags');
    if (!submission) return next(new NotFoundError('Submission not found'));
    res.json({ submission });
  } catch (err) {
    next(err);
  }
});

// POST /:id/confirm — Teammate confirms submission
router.post('/:id/confirm', auth, async (req, res, next) => {
  try {
    const submission = await missionService.confirmMission(req.params.id, req.user.sub);
    res.json({ submission });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/approve — Facilitator approves tier 3
router.patch('/:id/approve', auth, authorize('facilitator', 'school_admin', 'admin'), async (req, res, next) => {
  try {
    const submission = await missionService.approveMission(req.params.id, req.user.sub);
    res.json({ submission });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/reject — Facilitator rejects
router.patch('/:id/reject', auth, authorize('facilitator', 'school_admin', 'admin'), validate(rejectSchema), async (req, res, next) => {
  try {
    const submission = await missionService.rejectMission(req.params.id, req.user.sub, req.body.reason);
    res.json({ submission });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
