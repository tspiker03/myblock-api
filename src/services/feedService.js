'use strict';

const { FeedEntry, User } = require('../models');
const { NotFoundError } = require('../utils/errors');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

async function createFeedEntry(type, actorId, data, visibility) {
  const actor = await User.findById(actorId).select('username displayName schoolId classroomId teamId');
  if (!actor) throw new NotFoundError('Actor user not found');

  const entry = await FeedEntry.create({
    schoolId: actor.schoolId,
    classroomId: actor.classroomId,
    teamId: actor.teamId,
    type,
    actorId: actor._id,
    actorUsername: actor.username,
    actorDisplayName: actor.displayName,
    data: data || {},
    visibility,
    createdAt: new Date(),
  });

  return entry;
}

async function getFeed(userId, scope, since, limit) {
  const user = await User.findById(userId).select('schoolId classroomId teamId');
  if (!user) throw new NotFoundError('User not found');

  const resolvedLimit = Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT);
  const query = {};

  if (since) {
    query.createdAt = { $lt: new Date(since) };
  }

  if (scope === 'team') {
    query.teamId = user.teamId;
  } else if (scope === 'classroom') {
    query.classroomId = user.classroomId;
  } else {
    // school (default)
    query.schoolId = user.schoolId;
  }

  const entries = await FeedEntry.find(query)
    .sort({ createdAt: -1 })
    .limit(resolvedLimit);

  return entries;
}

async function createMissionCompleteFeedEntry(submission) {
  const data = {
    missionTitle: submission.missionTitle || null,
    tier: submission.tier,
    pillar: submission.pillar,
    teamPoints: submission.pointsAwarded ? submission.pointsAwarded.teamPoints : null,
    pillarPoints: submission.pointsAwarded ? submission.pointsAwarded.pillarPoints : null,
  };
  return createFeedEntry('mission_complete', submission.userId, data, 'classroom');
}

async function createGiftFeedEntry(senderId, recipientId, pillar, amount) {
  const recipient = await User.findById(recipientId).select('username');
  const data = {
    pillar,
    giftAmount: amount,
    recipientUsername: recipient ? recipient.username : null,
  };
  return createFeedEntry('gift', senderId, data, 'team');
}

async function createBuildingFeedEntry(userId, buildingName, action) {
  // action: 'placed' | 'upgraded'
  const type = action === 'upgraded' ? 'building_upgraded' : 'building_placed';
  const data = { buildingName };
  return createFeedEntry(type, userId, data, 'classroom');
}

module.exports = {
  createFeedEntry,
  getFeed,
  createMissionCompleteFeedEntry,
  createGiftFeedEntry,
  createBuildingFeedEntry,
};
