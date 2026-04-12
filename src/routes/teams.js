'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const { Team, User } = require('../models');
const teamService = require('../services/teamService');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { NotFoundError, ValidationError } = require('../utils/errors');

const createTeamSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
  classroomId: Joi.string().required(),
});

const joinTeamSchema = Joi.object({
  joinCode: Joi.string().length(6).uppercase().required(),
});

// POST / — Create team (facilitator only)
router.post('/', auth, authorize('facilitator', 'school_admin', 'admin'), validate(createTeamSchema), async (req, res, next) => {
  try {
    const { name, classroomId } = req.body;
    const team = await teamService.createTeam(name, classroomId, req.user.school_id);
    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
});

// GET /:id — Get team with members
router.get('/:id', auth, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return next(new NotFoundError('Team not found'));
    res.json({ team });
  } catch (err) {
    next(err);
  }
});

// POST /:id/join — Student joins via joinCode
router.post('/:id/join', auth, validate(joinTeamSchema), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return next(new NotFoundError('Team not found'));

    if (team.joinCode !== req.body.joinCode.toUpperCase()) {
      return next(new ValidationError('Invalid join code'));
    }

    const updatedTeam = await teamService.joinTeam(req.params.id, req.user.sub);
    res.json({ team: updatedTeam });
  } catch (err) {
    next(err);
  }
});

// GET /:id/members — List team members with balances
router.get('/:id/members', auth, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return next(new NotFoundError('Team not found'));

    const memberIds = team.members.map((m) => m.userId);
    const users = await User.find({ _id: { $in: memberIds } }).select(
      'username displayName avatar balances gradeLevel'
    );

    res.json({ members: users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
