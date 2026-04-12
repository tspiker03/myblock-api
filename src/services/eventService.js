'use strict';

const { Block, BlockEvent } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');

async function assignWeeklyEvents() {
  const events = await BlockEvent.find({ isActive: true });
  if (events.length === 0) return { assigned: 0 };

  const blocks = await Block.find({ activeEventId: null });
  let assigned = 0;

  for (const block of blocks) {
    const randomEvent = events[Math.floor(Math.random() * events.length)];
    block.activeEventId = randomEvent._id;
    await block.save();
    assigned++;
  }

  return { assigned };
}

async function checkEventResolution(userId, eventId) {
  const block = await Block.findOne({ userId });
  if (!block) throw new NotFoundError('Block not found');

  if (!block.activeEventId || String(block.activeEventId) !== String(eventId)) {
    throw new ValidationError('This event is not active on your block');
  }

  const event = await BlockEvent.findById(eventId);
  if (!event) throw new NotFoundError('Event not found');

  // Check building resolution
  if (event.resolutionBuilding && event.resolutionBuilding.buildingTemplateId) {
    const { buildingTemplateId, minLevel } = event.resolutionBuilding;
    for (const [, plot] of block.plots) {
      if (
        String(plot.buildingTemplateId) === String(buildingTemplateId) &&
        plot.level >= minLevel
      ) {
        return { canResolve: true, method: 'building' };
      }
    }
  }

  return { canResolve: false };
}

async function resolveEvent(userId, eventId) {
  const resolution = await checkEventResolution(userId, eventId);
  if (!resolution.canResolve) {
    throw new ValidationError('Resolution conditions not met');
  }

  const block = await Block.findOne({ userId });
  block.activeEventId = null;

  // Positive outcome: small population bonus (applied externally via population recalc)
  await block.save();
  return { resolved: true };
}

async function applyUnresolvedEvents() {
  const blocks = await Block.find({ activeEventId: { $ne: null } }).populate('activeEventId');
  let affected = 0;

  for (const block of blocks) {
    const event = block.activeEventId;
    if (!event || event.effect !== 'negative') continue;

    const impact = event.populationImpact || 0;
    block.population = Math.max(0, block.population + impact);
    block.activeEventId = null;
    await block.save();
    affected++;
  }

  return { affected };
}

module.exports = {
  assignWeeklyEvents,
  checkEventResolution,
  resolveEvent,
  applyUnresolvedEvents,
};
