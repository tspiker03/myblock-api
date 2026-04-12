'use strict';

const { Team, User } = require('../models');
const { ConflictError, NotFoundError, ValidationError } = require('../utils/errors');

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit O, 0, 1, I for readability
const MAX_MEMBERS = 6;

function generateJoinCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return code;
}

async function createTeam(name, classroomId, schoolId) {
  let joinCode;
  let attempts = 0;
  const maxAttempts = 10;

  // Retry until we get a unique code
  while (attempts < maxAttempts) {
    joinCode = generateJoinCode();
    const existing = await Team.findOne({ joinCode });
    if (!existing) break;
    attempts++;
    if (attempts === maxAttempts) {
      throw new Error('Could not generate a unique join code after max attempts');
    }
  }

  const team = await Team.create({ name, classroomId, schoolId, joinCode, members: [] });
  return team;
}

async function joinTeam(teamId, userId) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  const team = await Team.findById(teamId);
  if (!team) throw new NotFoundError('Team not found');
  if (!team.isActive) throw new ValidationError('Team is not active');

  // Check if already a member
  const alreadyMember = team.members.some((m) => String(m.userId) === String(userId));
  if (alreadyMember) throw new ConflictError('User is already a member of this team');

  if (team.members.length >= MAX_MEMBERS) {
    throw new ValidationError(`Team is full (max ${MAX_MEMBERS} members)`);
  }

  team.members.push({
    userId: user._id,
    username: user.username,
    displayName: user.displayName,
    avatarSpriteKey: user.avatar.spriteKey,
    joinedAt: new Date(),
  });

  await team.save();

  // Update user's teamId
  await User.findByIdAndUpdate(userId, { teamId: team._id });

  return team;
}

module.exports = { createTeam, joinTeam, generateJoinCode };
