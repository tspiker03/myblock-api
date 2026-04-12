'use strict';

const { User, Team } = require('../models');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { PILLARS, GIFT_RECEIVE_WEEKLY_CAP } = require('../utils/constants');
const feedService = require('./feedService');

function _currentWeekKey() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function canAfford(userId, costs) {
  const user = await User.findById(userId).select('balances');
  if (!user) throw new NotFoundError('User not found');

  for (const pillar of PILLARS) {
    const required = costs[pillar] || 0;
    if (required > 0 && (user.balances[pillar] || 0) < required) {
      return false;
    }
  }
  return true;
}

async function deductCosts(userId, costs) {
  const inc = {};
  for (const pillar of PILLARS) {
    if (costs[pillar] > 0) {
      inc[`balances.${pillar}`] = -costs[pillar];
    }
  }
  await User.findByIdAndUpdate(userId, { $inc: inc });
}

async function refundCosts(userId, costs) {
  const inc = {};
  for (const pillar of PILLARS) {
    if (costs[pillar] > 0) {
      inc[`balances.${pillar}`] = costs[pillar];
    }
  }
  await User.findByIdAndUpdate(userId, { $inc: inc });
}

async function giftPoints(senderId, recipientId, pillar, amount) {
  if (!PILLARS.includes(pillar)) {
    throw new ValidationError(`Invalid pillar: ${pillar}`);
  }
  if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
    throw new ValidationError('Amount must be a positive integer');
  }

  const [sender, recipient] = await Promise.all([
    User.findById(senderId),
    User.findById(recipientId),
  ]);

  if (!sender) throw new NotFoundError('Sender not found');
  if (!recipient) throw new NotFoundError('Recipient not found');

  // Must be on the same team
  if (!sender.teamId || !recipient.teamId || String(sender.teamId) !== String(recipient.teamId)) {
    throw new ForbiddenError('Can only gift points to teammates');
  }

  // Check sender balance
  if ((sender.balances[pillar] || 0) < amount) {
    throw new ValidationError('Insufficient pillar balance');
  }

  // Check weekly cap on recipient
  const weekKey = _currentWeekKey();
  const recipientWeekKey = recipient.gifting.weekKey;
  const receivedThisWeek =
    recipientWeekKey === weekKey ? recipient.gifting.receivedThisWeek : 0;

  if (receivedThisWeek + amount > GIFT_RECEIVE_WEEKLY_CAP) {
    throw new ValidationError(
      `Recipient would exceed weekly receiving cap of ${GIFT_RECEIVE_WEEKLY_CAP} points`
    );
  }

  // Deduct from sender
  await User.findByIdAndUpdate(senderId, {
    $inc: { [`balances.${pillar}`]: -amount },
  });

  // Add to recipient and update weekly tracking
  const giftingUpdate =
    recipientWeekKey === weekKey
      ? { $inc: { [`balances.${pillar}`]: amount, 'gifting.receivedThisWeek': amount } }
      : {
          $inc: { [`balances.${pillar}`]: amount },
          $set: { 'gifting.receivedThisWeek': amount, 'gifting.weekKey': weekKey },
        };

  await User.findByIdAndUpdate(recipientId, giftingUpdate);

  // Feed entry — fire-and-forget
  feedService.createGiftFeedEntry(senderId, recipientId, pillar, amount).catch(() => {});

  return { senderId, recipientId, pillar, amount };
}

module.exports = { canAfford, deductCosts, refundCosts, giftPoints };
