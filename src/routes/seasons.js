'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const { Season, User, Team } = require('../models');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

const createSeasonSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  theme: Joi.string().max(200).optional(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
});

function _requireFacilitatorOrAdmin(req) {
  if (!['facilitator', 'school_admin', 'admin'].includes(req.user.role)) {
    throw new ForbiddenError('Only facilitators and admins can manage seasons');
  }
}

// GET /seasons/current — Get current active season for user's school
router.get('/current', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('schoolId');
    const season = await Season.findOne({ schoolId: user.schoolId, isActive: true });
    res.json({ season: season || null });
  } catch (err) {
    next(err);
  }
});

// POST /seasons — Create season (facilitator/admin)
router.post('/', auth, validate(createSeasonSchema), async (req, res, next) => {
  try {
    _requireFacilitatorOrAdmin(req);
    const user = await User.findById(req.user.sub).select('schoolId');
    const { name, theme, startDate, endDate } = req.body;
    const season = await Season.create({
      name,
      theme: theme || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: false,
      schoolId: user.schoolId,
    });
    res.status(201).json({ season });
  } catch (err) {
    next(err);
  }
});

// POST /seasons/:id/reset-leaderboards — Reset team competition points (admin)
// NOTE: pillar points and blocks are NOT reset
router.post('/:id/reset-leaderboards', auth, async (req, res, next) => {
  try {
    _requireFacilitatorOrAdmin(req);

    const season = await Season.findById(req.params.id);
    if (!season) throw new NotFoundError('Season not found');

    const user = await User.findById(req.user.sub).select('schoolId');
    if (String(season.schoolId) !== String(user.schoolId)) {
      throw new ForbiddenError('Cannot reset a season from a different school');
    }

    // Reset teamPoints only for all users in this school
    await User.updateMany({ schoolId: season.schoolId }, { $set: { 'balances.teamPoints': 0 } });

    // Mark old season inactive, activate new season
    await Season.updateMany(
      { schoolId: season.schoolId, isActive: true },
      { $set: { isActive: false } }
    );
    season.isActive = true;
    await season.save();

    res.json({ message: 'Leaderboards reset. Team points zeroed. Pillar points and blocks intact.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
