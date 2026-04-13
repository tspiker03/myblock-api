'use strict';

const { Submission, User, Team, QuickRep, Leaderboard, Season, Classroom, MissionTemplate } = require('../models');
const { PILLARS } = require('../utils/constants');
const { NotFoundError } = require('../utils/errors');

// --- ISO week helpers ---

function getWeekStart() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day - 1));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Build a zero-filled pillar totals object
function zeroPillars() {
  const obj = {};
  for (const p of PILLARS) obj[p] = 0;
  return obj;
}

// --- getPillarDistribution ---

async function getPillarDistribution(classroomId, dateRange) {
  const matchStage = {
    classroomId: require('mongoose').Types.ObjectId.createFromHexString
      ? require('mongoose').Types.ObjectId.createFromHexString(String(classroomId))
      : new (require('mongoose').Types.ObjectId)(String(classroomId)),
    status: 'approved',
  };

  if (dateRange && (dateRange.start || dateRange.end)) {
    matchStage.completedAt = {};
    if (dateRange.start) matchStage.completedAt.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.completedAt.$lte = new Date(dateRange.end);
  }

  // classTotal — aggregate by pillar
  const classPillarAgg = await Submission.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$pillar',
        total: { $sum: '$pointsAwarded.pillarPoints' },
      },
    },
  ]);

  const classTotal = zeroPillars();
  for (const row of classPillarAgg) {
    if (row._id && classTotal.hasOwnProperty(row._id)) {
      classTotal[row._id] = row.total;
    }
  }

  // byTeam — aggregate by teamId + pillar
  const teamAgg = await Submission.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { teamId: '$teamId', pillar: '$pillar' },
        total: { $sum: '$pointsAwarded.pillarPoints' },
      },
    },
  ]);

  const teamMap = {};
  for (const row of teamAgg) {
    const tid = String(row._id.teamId);
    if (!teamMap[tid]) teamMap[tid] = { teamId: tid, ...zeroPillars() };
    if (row._id.pillar && teamMap[tid].hasOwnProperty(row._id.pillar)) {
      teamMap[tid][row._id.pillar] = row.total;
    }
  }

  // Fetch team names
  const teamIds = Object.keys(teamMap);
  const teams = await Team.find({ _id: { $in: teamIds } }).select('name');
  const teamNameMap = {};
  for (const t of teams) teamNameMap[String(t._id)] = t.name;

  const byTeam = Object.values(teamMap).map((entry) => ({
    teamId: entry.teamId,
    teamName: teamNameMap[entry.teamId] || 'Unknown Team',
    ...PILLARS.reduce((acc, p) => { acc[p] = entry[p]; return acc; }, {}),
  }));

  // byStudent — aggregate by userId + pillar
  const studentAgg = await Submission.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { userId: '$userId', pillar: '$pillar' },
        total: { $sum: '$pointsAwarded.pillarPoints' },
      },
    },
  ]);

  const studentMap = {};
  for (const row of studentAgg) {
    const uid = String(row._id.userId);
    if (!studentMap[uid]) studentMap[uid] = { userId: uid, ...zeroPillars() };
    if (row._id.pillar && studentMap[uid].hasOwnProperty(row._id.pillar)) {
      studentMap[uid][row._id.pillar] = row.total;
    }
  }

  // Fetch usernames
  const userIds = Object.keys(studentMap);
  const users = await User.find({ _id: { $in: userIds } }).select('username');
  const userNameMap = {};
  for (const u of users) userNameMap[String(u._id)] = u.username;

  const byStudent = Object.values(studentMap).map((entry) => ({
    userId: entry.userId,
    username: userNameMap[entry.userId] || 'unknown',
    ...PILLARS.reduce((acc, p) => { acc[p] = entry[p]; return acc; }, {}),
  }));

  // Generate insight — find lowest pillar class-wide
  let lowestPillar = PILLARS[0];
  let lowestValue = classTotal[PILLARS[0]];
  for (const p of PILLARS) {
    if (classTotal[p] < lowestValue) {
      lowestValue = classTotal[p];
      lowestPillar = p;
    }
  }

  const pillarLabel = lowestPillar.charAt(0).toUpperCase() + lowestPillar.slice(1).replace(/([A-Z])/g, ' $1');
  const insight = `${pillarLabel} is the lowest pillar class-wide — consider featuring ${pillarLabel} missions next week.`;

  return { classTotal, byTeam, byStudent, insight };
}

// --- getExportData ---

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function getExportData(classroomId, dateRange, format) {
  const mongoose = require('mongoose');
  const oid = mongoose.Types.ObjectId.createFromHexString
    ? mongoose.Types.ObjectId.createFromHexString(String(classroomId))
    : new mongoose.Types.ObjectId(String(classroomId));

  const matchStage = { classroomId: oid, status: 'approved' };

  if (dateRange && (dateRange.start || dateRange.end)) {
    matchStage.completedAt = {};
    if (dateRange.start) matchStage.completedAt.$gte = new Date(dateRange.start);
    if (dateRange.end) matchStage.completedAt.$lte = new Date(dateRange.end);
  }

  // Aggregate per-student: missions by tier + pillar points
  const submissionAgg = await Submission.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$userId',
        teamId: { $first: '$teamId' },
        tier1: { $sum: { $cond: [{ $eq: ['$tier', 1] }, 1, 0] } },
        tier2: { $sum: { $cond: [{ $eq: ['$tier', 2] }, 1, 0] } },
        tier3: { $sum: { $cond: [{ $eq: ['$tier', 3] }, 1, 0] } },
        totalTeamPts: { $sum: '$pointsAwarded.teamPoints' },
        agency: { $sum: { $cond: [{ $eq: ['$pillar', 'agency'] }, '$pointsAwarded.pillarPoints', 0] } },
        helping: { $sum: { $cond: [{ $eq: ['$pillar', 'helping'] }, '$pointsAwarded.pillarPoints', 0] } },
        character: { $sum: { $cond: [{ $eq: ['$pillar', 'character'] }, '$pointsAwarded.pillarPoints', 0] } },
        curiosity: { $sum: { $cond: [{ $eq: ['$pillar', 'curiosity'] }, '$pointsAwarded.pillarPoints', 0] } },
        learning: { $sum: { $cond: [{ $eq: ['$pillar', 'learning'] }, '$pointsAwarded.pillarPoints', 0] } },
        problemSolving: { $sum: { $cond: [{ $eq: ['$pillar', 'problemSolving'] }, '$pointsAwarded.pillarPoints', 0] } },
      },
    },
  ]);

  const userIds = submissionAgg.map((r) => r._id);
  const users = await User.find({ _id: { $in: userIds } }).select('username teamId');
  const userMap = {};
  for (const u of users) userMap[String(u._id)] = u;

  const teamIds = [...new Set(submissionAgg.map((r) => String(r.teamId)).filter(Boolean))];
  const teams = await Team.find({ _id: { $in: teamIds } }).select('name');
  const teamMap = {};
  for (const t of teams) teamMap[String(t._id)] = t.name;

  // Quick rep counts per user within date range
  const qrMatch = { userId: { $in: userIds } };
  if (dateRange && dateRange.start) qrMatch.completedAt = { $gte: new Date(dateRange.start) };
  if (dateRange && dateRange.end) {
    qrMatch.completedAt = qrMatch.completedAt || {};
    qrMatch.completedAt.$lte = new Date(dateRange.end);
  }
  const qrAgg = await QuickRep.aggregate([
    { $match: qrMatch },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  const qrMap = {};
  for (const r of qrAgg) qrMap[String(r._id)] = r.count;

  // Gift counts — not stored in separate model, so use FeedEntry type 'gift_sent'/'gift_received'
  // For now derive from FeedEntry if available, otherwise default to 0
  const { FeedEntry } = require('../models');
  const giftAgg = await FeedEntry.aggregate([
    {
      $match: {
        type: { $in: ['gift_sent', 'gift_received'] },
        actorId: { $in: userIds },
        ...(dateRange && dateRange.start ? { createdAt: { $gte: new Date(dateRange.start) } } : {}),
      },
    },
    {
      $group: {
        _id: { actorId: '$actorId', type: '$type' },
        count: { $sum: 1 },
      },
    },
  ]);
  const giftsGivenMap = {};
  const giftsReceivedMap = {};
  for (const r of giftAgg) {
    const uid = String(r._id.actorId);
    if (r._id.type === 'gift_sent') giftsGivenMap[uid] = r.count;
    if (r._id.type === 'gift_received') giftsReceivedMap[uid] = r.count;
  }

  const rows = submissionAgg.map((row) => {
    const uid = String(row._id);
    const teamName = teamMap[String(row.teamId)] || '';
    const username = userMap[uid] ? userMap[uid].username : '';
    return {
      username,
      team: teamName,
      missionsCompleted_t1: row.tier1,
      missionsCompleted_t2: row.tier2,
      missionsCompleted_t3: row.tier3,
      totalTeamPts: row.totalTeamPts,
      agency: row.agency,
      helping: row.helping,
      character: row.character,
      curiosity: row.curiosity,
      learning: row.learning,
      problemSolving: row.problemSolving,
      quickRepCount: qrMap[uid] || 0,
      giftsGiven: giftsGivenMap[uid] || 0,
      giftsReceived: giftsReceivedMap[uid] || 0,
    };
  });

  if (format === 'csv') {
    const headers = [
      'username', 'team', 'missionsCompleted_t1', 'missionsCompleted_t2', 'missionsCompleted_t3',
      'totalTeamPts', 'agency', 'helping', 'character', 'curiosity', 'learning', 'problemSolving',
      'quickRepCount', 'giftsGiven', 'giftsReceived',
    ];
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => escapeCSV(row[h])).join(','));
    }
    return { csv: lines.join('\n') };
  }

  // JSON / PDF structured format
  // Team rankings
  const teamTotalsMap = {};
  for (const row of submissionAgg) {
    const tid = String(row.teamId);
    if (!teamTotalsMap[tid]) teamTotalsMap[tid] = { teamId: tid, teamName: teamMap[tid] || '', totalTeamPts: 0 };
    teamTotalsMap[tid].totalTeamPts += row.totalTeamPts;
  }
  const teamRankings = Object.values(teamTotalsMap)
    .sort((a, b) => b.totalTeamPts - a.totalTeamPts)
    .map((t, i) => ({ ...t, rank: i + 1 }));

  const classPillarTotals = zeroPillars();
  for (const row of submissionAgg) {
    for (const p of PILLARS) classPillarTotals[p] += row[p] || 0;
  }

  return {
    classOverview: {
      totalMissions: submissionAgg.reduce((s, r) => s + r.tier1 + r.tier2 + r.tier3, 0),
      pillarTotals: classPillarTotals,
    },
    teamRankings,
    studentSummaryTable: rows,
  };
}

// --- generateSlideshowData ---

async function generateSlideshowData(classroomId) {
  const mongoose = require('mongoose');
  const oid = mongoose.Types.ObjectId.createFromHexString
    ? mongoose.Types.ObjectId.createFromHexString(String(classroomId))
    : new mongoose.Types.ObjectId(String(classroomId));

  const classroom = await Classroom.findById(classroomId).select('name seasonId schoolId');
  if (!classroom) throw new NotFoundError('Classroom not found');

  const weekStart = getWeekStart();
  const now = new Date();
  const weekNumber = getWeekNumber(weekStart);

  const weekMatch = {
    classroomId: oid,
    status: 'approved',
    completedAt: { $gte: weekStart, $lte: now },
  };

  // --- Slide 1: Title ---
  const slide1 = {
    type: 'title',
    title: `Week ${weekNumber} Wrap-Up — ${classroom.name}`,
    content: {
      weekNumber,
      className: classroom.name,
      dateRange: { start: weekStart.toISOString(), end: now.toISOString() },
    },
  };

  // --- Slide 2: Team leaderboard ---
  const leaderboard = await Leaderboard.findOne({ scope: 'team', scopeId: classroomId });
  const teams = leaderboard
    ? leaderboard.entries.map((e) => ({
        name: e.entityName,
        points: e.totalTeamPoints,
        rank: e.rank,
        movement: e.movement,
      }))
    : [];

  const slide2 = {
    type: 'leaderboard',
    title: 'Team Standings',
    content: { teams },
  };

  // --- Slides 3-5: Top mission highlights (prefer tier 3) ---
  const topSubmissions = await Submission.find(weekMatch)
    .sort({ tier: -1, 'pointsAwarded.teamPoints': -1 })
    .limit(3)
    .populate('userId', 'username displayName')
    .populate('missionTemplateId', 'title pillar tier');

  const missionSlides = topSubmissions.map((sub) => ({
    type: 'mission_highlight',
    title: 'Mission Spotlight',
    content: {
      username: sub.userId ? sub.userId.username : '',
      displayName: sub.userId ? sub.userId.displayName : '',
      missionTitle: sub.missionTemplateId ? sub.missionTemplateId.title : '',
      pillar: sub.pillar,
      tier: sub.tier,
      evidenceUrl: sub.evidenceUrls && sub.evidenceUrls.length > 0 ? sub.evidenceUrls[0] : null,
      reflection: null, // no reflection field on Submission; placeholder for frontend
    },
  }));

  // Pad to 3 slides if fewer than 3 submissions
  while (missionSlides.length < 3) {
    missionSlides.push({
      type: 'mission_highlight',
      title: 'Mission Spotlight',
      content: null,
    });
  }

  // --- Slide 6: Pillar chart ---
  const pillarAgg = await Submission.aggregate([
    { $match: weekMatch },
    {
      $group: {
        _id: '$pillar',
        total: { $sum: '$pointsAwarded.pillarPoints' },
      },
    },
  ]);

  const pillarTotals = zeroPillars();
  for (const row of pillarAgg) {
    if (row._id && pillarTotals.hasOwnProperty(row._id)) {
      pillarTotals[row._id] = row.total;
    }
  }

  const slide6 = {
    type: 'pillar_chart',
    title: 'Pillar Points This Week',
    content: { ...pillarTotals },
  };

  // --- Slide 7: Star student (highest total points this week) ---
  const starAgg = await Submission.aggregate([
    { $match: weekMatch },
    {
      $group: {
        _id: '$userId',
        totalPoints: { $sum: '$pointsAwarded.pillarPoints' },
        // track which pillar had the most
        agency: { $sum: { $cond: [{ $eq: ['$pillar', 'agency'] }, '$pointsAwarded.pillarPoints', 0] } },
        helping: { $sum: { $cond: [{ $eq: ['$pillar', 'helping'] }, '$pointsAwarded.pillarPoints', 0] } },
        character: { $sum: { $cond: [{ $eq: ['$pillar', 'character'] }, '$pointsAwarded.pillarPoints', 0] } },
        curiosity: { $sum: { $cond: [{ $eq: ['$pillar', 'curiosity'] }, '$pointsAwarded.pillarPoints', 0] } },
        learning: { $sum: { $cond: [{ $eq: ['$pillar', 'learning'] }, '$pointsAwarded.pillarPoints', 0] } },
        problemSolving: { $sum: { $cond: [{ $eq: ['$pillar', 'problemSolving'] }, '$pointsAwarded.pillarPoints', 0] } },
      },
    },
    { $sort: { totalPoints: -1 } },
    { $limit: 1 },
  ]);

  let slide7;
  if (starAgg.length > 0) {
    const star = starAgg[0];
    const starUser = await User.findById(star._id).select('username displayName');
    let topPillar = 'agency';
    let topPillarVal = 0;
    for (const p of PILLARS) {
      if (star[p] > topPillarVal) {
        topPillarVal = star[p];
        topPillar = p;
      }
    }
    slide7 = {
      type: 'star_student',
      title: 'Star of the Week',
      content: {
        username: starUser ? starUser.username : '',
        displayName: starUser ? starUser.displayName : '',
        totalPointsThisWeek: star.totalPoints,
        topPillar,
      },
    };
  } else {
    slide7 = {
      type: 'star_student',
      title: 'Star of the Week',
      content: null,
    };
  }

  // --- Slide 8: Season progress ---
  let slide8;
  if (classroom.seasonId) {
    const season = await Season.findById(classroom.seasonId);
    if (season) {
      const msPerDay = 86400000;
      const daysRemaining = Math.max(0, Math.ceil((season.endDate - now) / msPerDay));
      const totalDays = Math.ceil((season.endDate - season.startDate) / msPerDay);
      const daysElapsed = totalDays - daysRemaining;
      const progressPct = totalDays > 0 ? Math.round((daysElapsed / totalDays) * 100) : 0;

      slide8 = {
        type: 'season_progress',
        title: 'Season Update',
        content: {
          seasonName: season.name,
          daysRemaining,
          nextMilestone: progressPct < 50 ? 'Halfway Point' : progressPct < 75 ? 'Final Stretch' : 'Season End',
        },
      };
    }
  }

  if (!slide8) {
    slide8 = {
      type: 'season_progress',
      title: 'Season Update',
      content: null,
    };
  }

  return [slide1, slide2, ...missionSlides, slide6, slide7, slide8];
}

module.exports = { getPillarDistribution, getExportData, generateSlideshowData };
