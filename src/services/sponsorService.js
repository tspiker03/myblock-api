'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');
const { Sponsor, Prize, ThresholdDraw, User, Season, Submission } = require('../models');
const { AuthError, NotFoundError, ConflictError, ForbiddenError, ValidationError } = require('../utils/errors');
const { PILLARS } = require('../utils/constants');

const MIN_GROUP_SIZE = 10;

async function registerSponsor(data) {
  const { businessName, contactName, contactEmail, password, website, phone } = data;

  const existing = await Sponsor.findOne({ contactEmail });
  if (existing) throw new ConflictError('A sponsor with that email already exists', 'DUPLICATE_EMAIL');

  const passwordHash = await bcrypt.hash(password, 12);

  const sponsor = await Sponsor.create({
    businessName,
    contactName,
    contactEmail,
    passwordHash,
    website: website || null,
    phone: phone || null,
    status: 'pending',
  });

  // Return without passwordHash (select:false handles it on find; exclude on create manually)
  const result = sponsor.toObject();
  delete result.passwordHash;
  return result;
}

async function loginSponsor(email, password) {
  const sponsor = await Sponsor.findOne({ contactEmail: email }).select('+passwordHash');
  if (!sponsor) throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(password, sponsor.passwordHash);
  if (!valid) throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');

  if (sponsor.status !== 'approved') {
    throw new ForbiddenError('Sponsor account is not approved');
  }

  const token = jwt.sign(
    {
      sub: String(sponsor._id),
      role: 'sponsor',
      school_ids: sponsor.schoolIds.map(String),
      jti: uuidv4(),
    },
    config.jwtSecret,
    { expiresIn: '8h' }
  );

  return { token, sponsor: { _id: sponsor._id, businessName: sponsor.businessName, status: sponsor.status } };
}

async function listSponsors(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;

  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [sponsors, total] = await Promise.all([
    Sponsor.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Sponsor.countDocuments(query),
  ]);

  return { sponsors, total, page, limit };
}

async function approveSponsor(sponsorId, adminUserId) {
  const sponsor = await Sponsor.findById(sponsorId);
  if (!sponsor) throw new NotFoundError('Sponsor not found');

  sponsor.status = 'approved';
  sponsor.approvedBy = adminUserId;
  sponsor.approvedAt = new Date();
  await sponsor.save();

  return sponsor;
}

async function rejectSponsor(sponsorId, adminUserId) {
  const sponsor = await Sponsor.findById(sponsorId);
  if (!sponsor) throw new NotFoundError('Sponsor not found');

  sponsor.status = 'rejected';
  sponsor.reviewedBy = adminUserId;
  sponsor.reviewedAt = new Date();
  await sponsor.save();

  return sponsor;
}

async function getSponsorDashboard(sponsorId) {
  const sponsor = await Sponsor.findById(sponsorId);
  if (!sponsor) throw new NotFoundError('Sponsor not found');

  const schoolIds = sponsor.schoolIds;

  // Count active students across sponsor's schools
  const totalStudents = await User.countDocuments({
    schoolId: { $in: schoolIds },
    role: 'student',
    isActive: true,
  });

  // Enforce minimum group size for anonymization
  if (totalStudents < MIN_GROUP_SIZE) {
    return {
      totalStudents: null,
      totalMissionsCompleted: null,
      pillarDistribution: null,
      seasonProgress: null,
      notice: 'Insufficient data — minimum group size not met',
    };
  }

  // Count approved submissions across sponsor's schools
  const totalMissionsCompleted = await Submission.countDocuments({
    schoolId: { $in: schoolIds },
    status: 'approved',
  });

  // Aggregate pillar distribution across all students in sponsor's schools
  const pillarAgg = await User.aggregate([
    { $match: { schoolId: { $in: schoolIds }, role: 'student', isActive: true } },
    {
      $group: {
        _id: null,
        agency: { $sum: '$balances.agency' },
        helping: { $sum: '$balances.helping' },
        character: { $sum: '$balances.character' },
        curiosity: { $sum: '$balances.curiosity' },
        learning: { $sum: '$balances.learning' },
        problemSolving: { $sum: '$balances.problemSolving' },
      },
    },
  ]);

  const pillarDistribution = {};
  if (pillarAgg.length > 0) {
    for (const pillar of PILLARS) {
      pillarDistribution[pillar] = pillarAgg[0][pillar] || 0;
    }
  }

  // Current season info (most recent active season for any of the sponsor's schools)
  const season = await Season.findOne({ isActive: true }).sort({ startDate: -1 }).lean();

  return {
    totalStudents,
    totalMissionsCompleted,
    pillarDistribution,
    seasonProgress: season
      ? { name: season.name, startDate: season.startDate, endDate: season.endDate }
      : null,
  };
}

async function createPrize(sponsorId, data) {
  const sponsor = await Sponsor.findById(sponsorId);
  if (!sponsor) throw new NotFoundError('Sponsor not found');

  const prize = await Prize.create({
    sponsorId,
    name: data.name,
    description: data.description || null,
    imageUrl: data.imageUrl || null,
    estimatedValue: data.estimatedValue != null ? data.estimatedValue : undefined,
    deliveryMethod: data.deliveryMethod,
    tier: data.tier,
    schoolId: data.schoolId || null,
    seasonId: data.seasonId || null,
    status: 'pending_approval',
  });

  return prize;
}

async function approvePrize(prizeId, adminUserId) {
  const prize = await Prize.findById(prizeId);
  if (!prize) throw new NotFoundError('Prize not found');
  if (prize.status !== 'pending_approval') {
    throw new ValidationError(`Cannot approve a prize in status: ${prize.status}`);
  }

  prize.status = 'approved';
  prize.approvedBy = adminUserId;
  prize.approvedAt = new Date();
  await prize.save();

  return prize;
}

async function listSponsorPrizes(sponsorId) {
  return Prize.find({ sponsorId }).sort({ createdAt: -1 });
}

async function listPendingPrizes() {
  return Prize.find({ status: 'pending_approval' }).populate('sponsorId', 'businessName contactName').sort({ createdAt: 1 });
}

async function getMonthlyWinner(classroomId) {
  const mongoose = require('mongoose');
  const cidStr = String(classroomId);
  const oid = cidStr.length === 24
    ? (mongoose.Types.ObjectId.createFromHexString
        ? mongoose.Types.ObjectId.createFromHexString(cidStr)
        : new mongoose.Types.ObjectId(cidStr))
    : classroomId;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const results = await Submission.aggregate([
    {
      $match: {
        classroomId: oid,
        status: 'approved',
        completedAt: { $gte: startOfMonth },
      },
    },
    {
      $group: {
        _id: '$teamId',
        totalTeamPoints: { $sum: '$pointsAwarded.teamPoints' },
        missionCount: { $sum: 1 },
      },
    },
    { $sort: { totalTeamPoints: -1 } },
    { $limit: 1 },
  ]);

  if (!results.length) return null;

  const winner = results[0];
  return {
    teamId: winner._id,
    totalTeamPoints: winner.totalTeamPoints,
    missionCount: winner.missionCount,
    periodStart: startOfMonth,
    periodEnd: now,
  };
}

async function conductThresholdDraw(schoolId, seasonId) {
  // Find existing draw record or validate it can be run
  const existing = await ThresholdDraw.findOne({ schoolId, seasonId });
  if (existing && existing.status !== 'open') {
    throw new ConflictError(`Draw already completed with status: ${existing.status}`, 'DRAW_ALREADY_DONE');
  }

  // Find all active students in the school for this season
  const students = await User.find({
    schoolId,
    role: 'student',
    isActive: true,
  }).select('_id').lean();

  if (!students.length) {
    throw new ValidationError('No eligible students found for this school');
  }

  const studentIds = students.map((s) => s._id);

  // Randomly select a winner using crypto.randomInt
  const winnerIndex = crypto.randomInt(0, studentIds.length);
  const winnerId = studentIds[winnerIndex];

  const drawnAt = new Date();
  const drawLog = JSON.stringify({
    drawnAt: drawnAt.toISOString(),
    totalEligible: studentIds.length,
    winnerIndex,
    method: 'crypto.randomInt',
  });

  let draw;
  if (existing) {
    existing.qualifiedStudentIds = studentIds;
    existing.winnerId = winnerId;
    existing.drawnAt = drawnAt;
    existing.drawLog = drawLog;
    existing.status = 'drawn';
    draw = await existing.save();
  } else {
    draw = await ThresholdDraw.create({
      schoolId,
      seasonId,
      prizeId: null, // Prize association done separately or passed in future
      qualifiedStudentIds: studentIds,
      winnerId,
      drawnAt,
      drawLog,
      status: 'drawn',
    });
  }

  return draw;
}

module.exports = {
  registerSponsor,
  loginSponsor,
  listSponsors,
  approveSponsor,
  rejectSponsor,
  getSponsorDashboard,
  createPrize,
  approvePrize,
  listSponsorPrizes,
  listPendingPrizes,
  getMonthlyWinner,
  conductThresholdDraw,
};
