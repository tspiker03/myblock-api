'use strict';

const { User, Team, Classroom, Submission, QuickRep } = require('../models');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');
const { PILLARS } = require('../utils/constants');

function isoWeekKey(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekStart() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day - 1));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

async function getClassroom(classroomId) {
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) throw new NotFoundError('Classroom not found');
  return classroom;
}

async function assertStudentInClassroom(studentId, classroomId) {
  const student = await User.findOne({ _id: studentId, classroomId, role: 'student' });
  if (!student) throw new ForbiddenError('Student not found in your classroom');
  return student;
}

async function getAlerts(classroomId) {
  const alerts = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const inactiveStudents = await User.find({
    classroomId,
    role: 'student',
    isActive: true,
    $or: [{ lastActiveAt: null }, { lastActiveAt: { $lt: cutoff } }],
  }).select('username lastActiveAt');

  for (const student of inactiveStudents) {
    const daysSinceActive = student.lastActiveAt
      ? Math.floor((Date.now() - student.lastActiveAt.getTime()) / 86400000)
      : null;
    alerts.push({
      type: 'inactive_student',
      studentId: student._id,
      username: student.username,
      daysSinceActive,
    });
  }

  const teams = await Team.find({ classroomId, isActive: true }).select('name members');
  if (teams.length >= 2) {
    const standings = teams.map((t) => ({ id: t._id, name: t.name, points: 0 }));
    const teamIds = teams.map((t) => t._id);
    const users = await User.find({ teamId: { $in: teamIds }, classroomId }).select('teamId balances');
    for (const user of users) {
      const entry = standings.find((s) => String(s.id) === String(user.teamId));
      if (entry) entry.points += (user.balances && user.balances.teamPoints) || 0;
    }
    const points = standings.map((s) => s.points);
    const max = Math.max(...points);
    const min = Math.min(...points);
    if (min > 0 && max > 3 * min) {
      const lead = standings.find((s) => s.points === max);
      const trail = standings.find((s) => s.points === min);
      alerts.push({
        type: 'team_imbalance',
        leadTeam: { teamId: lead.id, teamName: lead.name },
        trailTeam: { teamId: trail.id, teamName: trail.name },
        ratio: Math.round((max / min) * 100) / 100,
      });
    }
  }

  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - 3);
  const staleSubmissions = await Submission.find({
    classroomId,
    status: 'pending_approval',
    createdAt: { $lt: staleCutoff },
  }).select('createdAt').sort({ createdAt: 1 });

  if (staleSubmissions.length > 0) {
    alerts.push({
      type: 'stale_queue',
      count: staleSubmissions.length,
      oldestDate: staleSubmissions[0].createdAt,
    });
  }

  return alerts;
}

async function getDashboard(classroomId) {
  await getClassroom(classroomId);

  const wStart = weekStart();
  const currentWeekKey = isoWeekKey(new Date());

  const [approvalQueueCount, weeklyMissionCount, alerts, teams] = await Promise.all([
    Submission.countDocuments({ classroomId, status: 'pending_approval' }),
    Submission.countDocuments({ classroomId, status: 'approved', completedAt: { $gte: wStart } }),
    getAlerts(classroomId),
    Team.find({ classroomId, isActive: true }).select('name'),
  ]);

  const studentIds = await User.find({ classroomId, role: 'student' }).distinct('_id');
  const weeklyQuickRepCount = await QuickRep.countDocuments({
    userId: { $in: studentIds },
    weekKey: currentWeekKey,
  });

  const teamIds = teams.map((t) => t._id);
  const users = await User.find({ teamId: { $in: teamIds }, classroomId }).select('teamId balances');

  const teamPointMap = {};
  for (const team of teams) {
    teamPointMap[String(team._id)] = { teamId: team._id, teamName: team.name, totalTeamPoints: 0 };
  }
  for (const user of users) {
    const key = String(user.teamId);
    if (teamPointMap[key]) {
      teamPointMap[key].totalTeamPoints += (user.balances && user.balances.teamPoints) || 0;
    }
  }
  const teamStandings = Object.values(teamPointMap).sort(
    (a, b) => b.totalTeamPoints - a.totalTeamPoints
  );

  return {
    approvalQueueCount,
    weeklyMissionCount,
    weeklyQuickRepCount,
    teamStandings,
    alertCount: alerts.length,
  };
}

async function getStudentRoster(classroomId, options = {}) {
  const { page = 1, limit = 25, sortBy = 'username', search } = options;

  const filter = { classroomId, role: 'student' };
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { username: { $regex: escaped, $options: 'i' } },
      { displayName: { $regex: escaped, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [students, total] = await Promise.all([
    User.find(filter)
      .sort({ [sortBy]: 1 })
      .skip(skip)
      .limit(limit)
      .select('username displayName teamId balances gradeLevel')
      .lean(),
    User.countDocuments(filter),
  ]);

  const teamIds = [...new Set(students.map((s) => String(s.teamId)).filter(Boolean))];
  const teams = await Team.find({ _id: { $in: teamIds } }).select('name').lean();
  const teamMap = {};
  for (const t of teams) teamMap[String(t._id)] = t.name;

  const userIds = students.map((s) => s._id);
  const missionCounts = await Submission.aggregate([
    { $match: { userId: { $in: userIds }, status: 'approved' } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  const missionCountMap = {};
  for (const mc of missionCounts) missionCountMap[String(mc._id)] = mc.count;

  const result = students.map((s) => ({
    ...s,
    teamName: teamMap[String(s.teamId)] || null,
    missionCount: missionCountMap[String(s._id)] || 0,
  }));

  return { students: result, total, page, limit };
}

async function getStudentDetail(studentId, classroomId) {
  const student = await User.findOne({ _id: studentId, classroomId, role: 'student' })
    .select('-passwordHash -parentConsentToken -fcmTokens')
    .lean();
  if (!student) throw new NotFoundError('Student not found in your classroom');

  const team = student.teamId
    ? await Team.findById(student.teamId).select('name').lean()
    : null;

  const approvedSubmissions = await Submission.find({ userId: studentId, status: 'approved' })
    .sort({ createdAt: -1 })
    .lean();

  const pillarBreakdown = {};
  for (const pillar of PILLARS) {
    pillarBreakdown[pillar] = {
      currentBalance: student.balances[pillar] || 0,
      totalEarned: 0,
    };
  }
  for (const sub of approvedSubmissions) {
    if (sub.pointsAwarded && sub.pointsAwarded.pillar && pillarBreakdown[sub.pointsAwarded.pillar]) {
      pillarBreakdown[sub.pointsAwarded.pillar].totalEarned += sub.pointsAwarded.pillarPoints || 0;
    }
  }

  const currentWeekKey = isoWeekKey(new Date());
  const [quickRepThisWeek, quickRepAllTime] = await Promise.all([
    QuickRep.countDocuments({ userId: studentId, weekKey: currentWeekKey }),
    QuickRep.countDocuments({ userId: studentId }),
  ]);

  return {
    profile: {
      ...student,
      teamName: team ? team.name : null,
    },
    pillarBreakdown,
    missionHistory: approvedSubmissions,
    quickRepStats: {
      thisWeek: quickRepThisWeek,
      allTime: quickRepAllTime,
    },
    giftingStats: {
      receivedThisWeek: student.gifting ? student.gifting.receivedThisWeek || 0 : 0,
    },
    enhancedReview: student.enhancedReview || false,
  };
}

async function toggleEnhancedReview(studentId, classroomId) {
  const student = await assertStudentInClassroom(studentId, classroomId);
  student.enhancedReview = !student.enhancedReview;
  await student.save();
  return { studentId: student._id, enhancedReview: student.enhancedReview };
}

async function resetStudentPassword(studentId, classroomId, newPasswordHash) {
  await assertStudentInClassroom(studentId, classroomId);
  await User.findByIdAndUpdate(studentId, { passwordHash: newPasswordHash });
}

async function moveStudentTeam(studentId, classroomId, newTeamId) {
  const student = await assertStudentInClassroom(studentId, classroomId);

  const newTeam = await Team.findOne({ _id: newTeamId, classroomId });
  if (!newTeam) throw new NotFoundError('Team not found in your classroom');
  if (newTeam.members.length >= 6) throw new ValidationError('Target team is full (max 6 members)');

  if (String(student.teamId) === String(newTeamId)) {
    throw new ValidationError('Student is already on that team');
  }

  const oldTeamId = student.teamId;

  // Sequential writes — if one fails, attempt rollback of prior steps
  await User.findByIdAndUpdate(studentId, { teamId: newTeamId });
  try {
    await Team.findByIdAndUpdate(oldTeamId, {
      $pull: { members: { userId: student._id } },
    });
  } catch (err) {
    await User.findByIdAndUpdate(studentId, { teamId: oldTeamId });
    throw err;
  }
  try {
    await Team.findByIdAndUpdate(newTeamId, {
      $push: {
        members: {
          userId: student._id,
          username: student.username,
          displayName: student.displayName,
          avatarSpriteKey: student.avatar ? student.avatar.spriteKey : 'default',
          joinedAt: new Date(),
        },
      },
    });
  } catch (err) {
    await User.findByIdAndUpdate(studentId, { teamId: oldTeamId });
    await Team.findByIdAndUpdate(oldTeamId, {
      $push: {
        members: {
          userId: student._id,
          username: student.username,
          displayName: student.displayName,
          avatarSpriteKey: student.avatar ? student.avatar.spriteKey : 'default',
          joinedAt: new Date(),
        },
      },
    });
    throw err;
  }

  return { studentId: student._id, newTeamId };
}

module.exports = {
  getDashboard,
  getAlerts,
  getStudentRoster,
  getStudentDetail,
  toggleEnhancedReview,
  resetStudentPassword,
  moveStudentTeam,
};
