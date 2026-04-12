'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const { MissionTemplate } = require('../models');
const missionService = require('../services/missionService');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const completeSchema = Joi.object({
  evidenceUrls: Joi.array().items(Joi.string().uri()).min(1).required(),
});

// GET / — List active mission templates with optional filters
router.get('/', auth, async (req, res, next) => {
  try {
    const filter = { isActive: true };

    if (req.query.pillar) filter.pillar = req.query.pillar;
    if (req.query.tier) filter.tier = parseInt(req.query.tier, 10);
    if (req.query.gradeLevel) {
      const grade = parseInt(req.query.gradeLevel, 10);
      filter['gradeRange.min'] = { $lte: grade };
      filter['gradeRange.max'] = { $gte: grade };
    }

    const templates = await MissionTemplate.find(filter).sort({ tier: 1, pillar: 1 });
    res.json({ missions: templates });
  } catch (err) {
    next(err);
  }
});

// POST /:templateId/start — Lock-in a mission
router.post('/:templateId/start', auth, async (req, res, next) => {
  try {
    const submission = await missionService.startMission(req.user.sub, req.params.templateId);
    res.status(201).json({ submission });
  } catch (err) {
    next(err);
  }
});

// POST /:submissionId/complete — Add evidence, move to pending_confirmation
router.post('/:submissionId/complete', auth, validate(completeSchema), async (req, res, next) => {
  try {
    const submission = await missionService.completeMission(
      req.params.submissionId,
      req.body.evidenceUrls
    );
    res.json({ submission });
  } catch (err) {
    next(err);
  }
});

// POST /:submissionId/abandon
router.post('/:submissionId/abandon', auth, async (req, res, next) => {
  try {
    const submission = await missionService.abandonMission(req.params.submissionId);
    res.json({ submission });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
