'use strict';

const { QuickRep, User } = require('../models');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { POINT_VALUES } = require('../utils/constants');
const feedService = require('./feedService');

const QUICK_REP_WEEKLY_CAP = 4; // reps per week

function _isoWeekKey(date) {
  // Returns "YYYY-WNN" for the ISO week containing the given date
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // Set to Thursday of this week so the year calculation is correct
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function getWeeklyCount(userId) {
  const weekKey = _isoWeekKey(new Date());
  const count = await QuickRep.countDocuments({ userId, weekKey });
  return count;
}

async function logQuickRep(userId, name) {
  const user = await User.findById(userId).select('teamId schoolId username displayName');
  if (!user) throw new NotFoundError('User not found');

  const weekKey = _isoWeekKey(new Date());
  const count = await QuickRep.countDocuments({ userId, weekKey });

  if (count >= QUICK_REP_WEEKLY_CAP) {
    throw new ValidationError(
      `Weekly quick rep cap reached (${QUICK_REP_WEEKLY_CAP} reps = ${QUICK_REP_WEEKLY_CAP * POINT_VALUES.QUICK_REP.teamPoints} team pts/week)`
    );
  }

  const now = new Date();
  const rep = await QuickRep.create({
    userId,
    teamId: user.teamId,
    schoolId: user.schoolId,
    name,
    completedAt: now,
    weekKey,
  });

  // Award points
  await User.findByIdAndUpdate(userId, {
    $inc: {
      'balances.teamPoints': POINT_VALUES.QUICK_REP.teamPoints,
      'balances.cosmeticPoints': POINT_VALUES.QUICK_REP.cosmeticPoints,
    },
  });

  // Feed entry
  await feedService.createFeedEntry(
    'quick_rep',
    userId,
    { repName: name, teamPoints: POINT_VALUES.QUICK_REP.teamPoints },
    'team'
  );

  return {
    rep,
    pointsAwarded: {
      teamPoints: POINT_VALUES.QUICK_REP.teamPoints,
      cosmeticPoints: POINT_VALUES.QUICK_REP.cosmeticPoints,
    },
    weeklyCount: count + 1,
    weeklyRemaining: QUICK_REP_WEEKLY_CAP - (count + 1),
  };
}

module.exports = { logQuickRep, getWeeklyCount, QUICK_REP_WEEKLY_CAP, _isoWeekKey };
