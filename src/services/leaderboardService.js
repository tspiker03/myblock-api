'use strict';

const { Leaderboard, User, Team, Classroom } = require('../models');
const { NotFoundError } = require('../utils/errors');

function calculateMovement(currentRank, previousRank) {
  if (previousRank === null || previousRank === undefined) return 0;
  return previousRank - currentRank; // positive = moved up
}

async function updateTeamLeaderboard(classroomId) {
  // Aggregate team points: sum all members' teamPoints per team
  const members = await User.find({ classroomId }).select('teamId balances.teamPoints');

  const teamTotals = {};
  for (const member of members) {
    if (!member.teamId) continue;
    const tid = String(member.teamId);
    teamTotals[tid] = (teamTotals[tid] || 0) + (member.balances.teamPoints || 0);
  }

  // Fetch team names
  const teamIds = Object.keys(teamTotals);
  const teams = await Team.find({ _id: { $in: teamIds } }).select('name');
  const teamNameMap = {};
  for (const t of teams) {
    teamNameMap[String(t._id)] = t.name;
  }

  // Sort by total descending to determine rank
  const sorted = teamIds.sort((a, b) => teamTotals[b] - teamTotals[a]);

  // Fetch previous leaderboard for movement tracking
  const existing = await Leaderboard.findOne({ scope: 'team', scopeId: classroomId });
  const previousRankMap = {};
  if (existing) {
    for (const e of existing.entries) {
      previousRankMap[String(e.entityId)] = e.rank;
    }
  }

  const entries = sorted.map((tid, idx) => {
    const currentRank = idx + 1;
    const previousRank = previousRankMap[tid] || null;
    return {
      entityId: tid,
      entityName: teamNameMap[tid] || 'Unknown Team',
      totalTeamPoints: teamTotals[tid],
      rank: currentRank,
      previousRank,
      movement: calculateMovement(currentRank, previousRank),
    };
  });

  const leaderboard = await Leaderboard.findOneAndUpdate(
    { scope: 'team', scopeId: classroomId },
    { entries, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  return leaderboard;
}

async function updateClassroomLeaderboard(schoolId) {
  // Sum all user teamPoints per classroom
  const members = await User.find({ schoolId }).select('classroomId balances.teamPoints');

  const classroomTotals = {};
  for (const member of members) {
    if (!member.classroomId) continue;
    const cid = String(member.classroomId);
    classroomTotals[cid] = (classroomTotals[cid] || 0) + (member.balances.teamPoints || 0);
  }

  const classroomIds = Object.keys(classroomTotals);
  const classrooms = await Classroom.find({ _id: { $in: classroomIds } }).select('name');
  const classroomNameMap = {};
  for (const c of classrooms) {
    classroomNameMap[String(c._id)] = c.name;
  }

  const sorted = classroomIds.sort((a, b) => classroomTotals[b] - classroomTotals[a]);

  const existing = await Leaderboard.findOne({ scope: 'classroom', scopeId: schoolId });
  const previousRankMap = {};
  if (existing) {
    for (const e of existing.entries) {
      previousRankMap[String(e.entityId)] = e.rank;
    }
  }

  const entries = sorted.map((cid, idx) => {
    const currentRank = idx + 1;
    const previousRank = previousRankMap[cid] || null;
    return {
      entityId: cid,
      entityName: classroomNameMap[cid] || 'Unknown Classroom',
      totalTeamPoints: classroomTotals[cid],
      rank: currentRank,
      previousRank,
      movement: calculateMovement(currentRank, previousRank),
    };
  });

  const leaderboard = await Leaderboard.findOneAndUpdate(
    { scope: 'classroom', scopeId: schoolId },
    { entries, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  return leaderboard;
}

async function getLeaderboard(scope, scopeId) {
  const leaderboard = await Leaderboard.findOne({ scope, scopeId });
  if (!leaderboard) throw new NotFoundError('Leaderboard not found');
  return leaderboard;
}

module.exports = {
  updateTeamLeaderboard,
  updateClassroomLeaderboard,
  getLeaderboard,
  calculateMovement,
};
