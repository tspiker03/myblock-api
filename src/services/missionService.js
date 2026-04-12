'use strict';

const { Submission, User, MissionTemplate } = require('../models');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');
const { POINT_VALUES } = require('../utils/constants');
const feedService = require('./feedService');

/**
 * Atomic lock-in: create Submission then use findOneAndUpdate to claim activeMissionId.
 * If the user already has an active mission, delete the orphaned submission and return 409.
 */
async function startMission(userId, templateId) {
  const template = await MissionTemplate.findById(templateId);
  if (!template || !template.isActive) throw new NotFoundError('Mission template not found');

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  // Create submission first
  const submission = await Submission.create({
    userId,
    teamId: user.teamId,
    schoolId: user.schoolId,
    classroomId: user.classroomId,
    missionTemplateId: template._id,
    tier: template.tier,
    pillar: template.pillar,
    status: 'active',
    startedAt: new Date(),
  });

  // Atomic claim: only succeeds if activeMissionId is currently null
  const updated = await User.findOneAndUpdate(
    { _id: userId, activeMissionId: null },
    { activeMissionId: submission._id },
    { new: true }
  );

  if (!updated) {
    // Race lost — another mission was already locked in
    await Submission.findByIdAndDelete(submission._id);
    throw new ConflictError('User already has an active mission', 'ALREADY_LOCKED');
  }

  return submission;
}

async function completeMission(submissionId, evidenceUrls) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new NotFoundError('Submission not found');
  if (submission.status !== 'active') {
    throw new ValidationError(`Cannot complete a mission in status: ${submission.status}`);
  }

  submission.evidenceUrls = evidenceUrls;
  submission.status = 'pending_confirmation';
  submission.completedAt = new Date();
  await submission.save();

  return submission;
}

async function confirmMission(submissionId, confirmerId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new NotFoundError('Submission not found');
  if (submission.status !== 'pending_confirmation') {
    throw new ValidationError(`Cannot confirm a mission in status: ${submission.status}`);
  }
  if (String(submission.userId) === String(confirmerId)) {
    throw new ValidationError('Users cannot confirm their own missions');
  }

  submission.confirmedBy = { userId: confirmerId, confirmedAt: new Date() };

  // Tier 1 and 2 auto-approve; Tier 3 needs facilitator
  if (submission.tier === 1 || submission.tier === 2) {
    await _approve(submission, null);
  } else {
    submission.status = 'pending_approval';
    await submission.save();
  }

  return submission;
}

async function approveMission(submissionId, approverId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new NotFoundError('Submission not found');
  if (submission.status !== 'pending_approval') {
    throw new ValidationError(`Cannot approve a mission in status: ${submission.status}`);
  }

  await _approve(submission, approverId);
  return submission;
}

async function _approve(submission, approverId) {
  const tierKey = `TIER_${submission.tier}`;
  const points = POINT_VALUES[tierKey];

  submission.status = 'approved';
  submission.approvedBy = approverId
    ? { userId: approverId, approvedAt: new Date() }
    : submission.approvedBy;
  submission.pointsAwarded = {
    teamPoints: points.teamPoints,
    pillarPoints: points.pillarPoints,
    pillar: submission.pillar,
  };

  await submission.save();
  await awardPoints(submission.userId, submission.tier, submission.pillar);
  await User.findByIdAndUpdate(submission.userId, { activeMissionId: null });

  // Feed entry — fire-and-forget, don't let feed errors break approval
  feedService.createMissionCompleteFeedEntry(submission).catch(() => {});
}

async function rejectMission(submissionId, rejectorId, reason) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new NotFoundError('Submission not found');
  if (submission.status !== 'pending_approval') {
    throw new ValidationError(`Cannot reject a mission in status: ${submission.status}`);
  }

  submission.status = 'rejected';
  submission.rejectedReason = reason || null;
  await submission.save();

  await User.findByIdAndUpdate(submission.userId, { activeMissionId: null });
  return submission;
}

async function abandonMission(submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new NotFoundError('Submission not found');
  if (!['active', 'pending_confirmation'].includes(submission.status)) {
    throw new ValidationError(`Cannot abandon a mission in status: ${submission.status}`);
  }

  submission.status = 'abandoned';
  await submission.save();

  await User.findByIdAndUpdate(submission.userId, { activeMissionId: null });
  return submission;
}

async function awardPoints(userId, tier, pillar) {
  const tierKey = `TIER_${tier}`;
  const points = POINT_VALUES[tierKey];

  const balanceUpdate = {
    $inc: {
      'balances.teamPoints': points.teamPoints,
      [`balances.${pillar}`]: points.pillarPoints,
    },
  };

  await User.findByIdAndUpdate(userId, balanceUpdate);
}

module.exports = {
  startMission,
  completeMission,
  confirmMission,
  approveMission,
  rejectMission,
  abandonMission,
  awardPoints,
};
