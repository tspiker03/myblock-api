'use strict';

const { CivicTask, CivicTaskCompletion, User } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const feedService = require('./feedService');

async function getAvailableTasks(userId, targetBlockUserId) {
  const allTasks = await CivicTask.find({ isActive: true });

  // Find any completions by this user on this block that haven't expired yet
  const now = new Date();
  const recentCompletions = await CivicTaskCompletion.find({
    userId,
    targetBlockUserId,
    nextAvailableAt: { $gt: now },
  }).select('civicTaskId');

  const onCooldownIds = new Set(recentCompletions.map((c) => String(c.civicTaskId)));

  return allTasks.filter((task) => !onCooldownIds.has(String(task._id)));
}

async function completeCivicTask(userId, civicTaskId, targetBlockUserId) {
  const [task, user] = await Promise.all([
    CivicTask.findById(civicTaskId),
    User.findById(userId).select('username displayName schoolId classroomId teamId balances'),
  ]);

  if (!task || !task.isActive) throw new NotFoundError('Civic task not found');
  if (!user) throw new NotFoundError('User not found');

  // Check respawn timer
  const now = new Date();
  const existing = await CivicTaskCompletion.findOne({
    userId,
    civicTaskId,
    targetBlockUserId,
    nextAvailableAt: { $gt: now },
  });

  if (existing) {
    throw new ValidationError(
      `This task is on cooldown until ${existing.nextAvailableAt.toISOString()}`
    );
  }

  const nextAvailableAt = new Date(now.getTime() + task.respawnMinutes * 60 * 1000);

  await CivicTaskCompletion.create({
    userId,
    civicTaskId,
    targetBlockUserId,
    completedAt: now,
    nextAvailableAt,
  });

  // Award cosmetic points
  await User.findByIdAndUpdate(userId, {
    $inc: { 'balances.cosmeticPoints': task.cosmeticPointReward },
  });

  // Create feed entry
  await feedService.createFeedEntry(
    'mission_complete', // reuse closest type — civic tasks are community actions
    userId,
    { civicTaskName: task.name, cosmeticPointReward: task.cosmeticPointReward, targetBlockUserId },
    'team'
  );

  return { task, cosmeticPointsAwarded: task.cosmeticPointReward, nextAvailableAt };
}

module.exports = { getAvailableTasks, completeCivicTask };
