'use strict';

const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { Classroom } = require('../models');
const facilitatorService = require('../services/facilitatorService');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { NotFoundError } = require('../utils/errors');

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(6).required(),
});

const moveTeamSchema = Joi.object({
  teamId: Joi.string().pattern(/^[a-f\d]{24}$/i).required().messages({
    'string.pattern.base': 'teamId must be a valid ObjectId',
  }),
});

async function resolveClassroomId(req, res, next) {
  try {
    let classroom;
    if (req.query.classroomId) {
      classroom = await Classroom.findOne({ _id: req.query.classroomId, facilitatorId: req.user.sub }).select('_id');
    } else {
      classroom = await Classroom.findOne({ facilitatorId: req.user.sub }).select('_id');
    }
    if (!classroom) return next(new NotFoundError('No classroom found for this facilitator'));
    req.classroomId = classroom._id;
    next();
  } catch (err) {
    next(err);
  }
}

const guard = [auth, authorize('facilitator', 'school_admin', 'admin'), resolveClassroomId];

router.get('/dashboard', ...guard, async (req, res, next) => {
  try {
    const data = await facilitatorService.getDashboard(req.classroomId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', ...guard, async (req, res, next) => {
  try {
    const alerts = await facilitatorService.getAlerts(req.classroomId);
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

router.get('/students', ...guard, async (req, res, next) => {
  try {
    const { page = 1, limit = 25, sortBy = 'username', search } = req.query;
    const data = await facilitatorService.getStudentRoster(req.classroomId, {
      page: Number(page),
      limit: Number(limit),
      sortBy,
      search,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/students/:studentId', ...guard, async (req, res, next) => {
  try {
    const data = await facilitatorService.getStudentDetail(req.params.studentId, req.classroomId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/students/:studentId/enhanced-review', ...guard, async (req, res, next) => {
  try {
    const data = await facilitatorService.toggleEnhancedReview(req.params.studentId, req.classroomId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/students/:studentId/reset-password', ...guard, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    await facilitatorService.resetStudentPassword(req.params.studentId, req.classroomId, hash);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/students/:studentId/move-team', ...guard, validate(moveTeamSchema), async (req, res, next) => {
  try {
    const data = await facilitatorService.moveStudentTeam(req.params.studentId, req.classroomId, req.body.teamId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
