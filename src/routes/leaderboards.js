'use strict';

const express = require('express');
const router = express.Router();

const leaderboardService = require('../services/leaderboardService');
const { User } = require('../models');
const auth = require('../middleware/auth');
const { NotFoundError } = require('../utils/errors');

// GET /leaderboards/team — Team leaderboard within user's classroom
router.get('/team', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('classroomId');
    if (!user || !user.classroomId) throw new NotFoundError('User not in a classroom');
    const leaderboard = await leaderboardService.getLeaderboard('team', user.classroomId);
    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

// GET /leaderboards/classroom — Classroom leaderboard within user's school
router.get('/classroom', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('schoolId');
    if (!user || !user.schoolId) throw new NotFoundError('User not in a school');
    const leaderboard = await leaderboardService.getLeaderboard('classroom', user.schoolId);
    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

// GET /leaderboards/school — School-level board (multi-school setups)
router.get('/school', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('schoolId');
    if (!user || !user.schoolId) throw new NotFoundError('User not in a school');
    const leaderboard = await leaderboardService.getLeaderboard('school', user.schoolId);
    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
