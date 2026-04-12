'use strict';

const { Block, BuildingTemplate, User } = require('../models');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');
const economyService = require('./economyService');

const GRID_SIZE = 10;
const EXPANSION_THRESHOLD = 6000;

function _plotKey(col, row) {
  return `${col},${row}`;
}

function _validateGridBounds(col, row, tileSize) {
  const span = tileSize === 4 ? 3 : tileSize; // 4 = 3x3 approximation
  if (col < 0 || row < 0 || col + span > GRID_SIZE || row + span > GRID_SIZE) {
    throw new ValidationError(`Building does not fit within the ${GRID_SIZE}x${GRID_SIZE} grid`);
  }
}

function _getOccupiedKeys(col, row, tileSize) {
  const span = tileSize === 4 ? 3 : tileSize;
  const keys = [];
  for (let c = col; c < col + span; c++) {
    for (let r = row; r < row + span; r++) {
      keys.push(_plotKey(c, r));
    }
  }
  return keys;
}

function calculatePopulation(block) {
  let total = 0;
  for (const [, plot] of block.plots) {
    if (plot._populationContrib !== undefined) {
      total += plot._populationContrib;
    }
  }
  return total;
}

async function _recalculatePopulation(block) {
  let total = 0;
  const templateIds = [];
  for (const [, plot] of block.plots) {
    templateIds.push(plot.buildingTemplateId);
  }

  if (templateIds.length === 0) {
    block.population = 0;
    return;
  }

  const templates = await BuildingTemplate.find({ _id: { $in: templateIds } }).select('population');
  const templateMap = {};
  for (const t of templates) {
    templateMap[String(t._id)] = t.population;
  }

  for (const [, plot] of block.plots) {
    const pop = templateMap[String(plot.buildingTemplateId)];
    if (pop) {
      const levelKey = `level${plot.level}`;
      total += pop[levelKey] || 0;
    }
  }

  block.population = total;
}

function checkExpansionUnlock(block) {
  if (!block.expansionUnlocked && block.totalPointsSpent >= EXPANSION_THRESHOLD) {
    block.expansionUnlocked = true;
  }
}

async function getBlock(userId) {
  const user = await User.findById(userId).select('schoolId');
  if (!user) throw new NotFoundError('User not found');

  let block = await Block.findOne({ userId });
  if (!block) {
    block = await Block.create({ userId, schoolId: user.schoolId });
  }
  return block;
}

async function placeBuilding(userId, buildingTemplateId, col, row) {
  const template = await BuildingTemplate.findById(buildingTemplateId);
  if (!template || !template.isActive) throw new NotFoundError('Building template not found');

  col = parseInt(col, 10);
  row = parseInt(row, 10);
  _validateGridBounds(col, row, template.tileSize);

  const block = await getBlock(userId);
  const occupiedKeys = _getOccupiedKeys(col, row, template.tileSize);

  // Check all required cells are empty
  for (const key of occupiedKeys) {
    if (block.plots.get(key)) {
      throw new ValidationError(`Plot ${key} is already occupied`);
    }
  }

  const costs = template.costs.level1;

  // Check affordability
  const affordable = await economyService.canAfford(userId, costs);
  if (!affordable) throw new ValidationError('Insufficient pillar points to place this building');

  // Deduct costs
  await economyService.deductCosts(userId, costs);

  // Calculate total spent for expansion unlock
  const totalSpent = Object.values(costs).reduce((sum, v) => sum + (v || 0), 0);

  // Place in all occupied cells (anchor is first key, others reference back)
  const now = new Date();
  const anchorKey = _plotKey(col, row);
  block.plots.set(anchorKey, {
    buildingTemplateId: template._id,
    level: 1,
    skinId: null,
    placedAt: now,
    upgradedAt: null,
  });

  // For multi-tile buildings, mark satellite cells pointing to anchor
  for (let i = 1; i < occupiedKeys.length; i++) {
    block.plots.set(occupiedKeys[i], {
      buildingTemplateId: template._id,
      level: 1,
      skinId: null,
      placedAt: now,
      upgradedAt: null,
    });
  }

  block.totalPointsSpent = (block.totalPointsSpent || 0) + totalSpent;
  checkExpansionUnlock(block);
  await _recalculatePopulation(block);
  block.markModified('plots');
  await block.save();

  return block;
}

async function upgradeBuilding(userId, col, row) {
  col = parseInt(col, 10);
  row = parseInt(row, 10);
  const key = _plotKey(col, row);

  const block = await getBlock(userId);
  const plot = block.plots.get(key);
  if (!plot) throw new NotFoundError(`No building at plot ${key}`);

  const template = await BuildingTemplate.findById(plot.buildingTemplateId);
  if (!template) throw new NotFoundError('Building template not found');

  if (plot.level >= template.maxLevel) {
    throw new ValidationError('Building is already at maximum level');
  }

  const nextLevel = plot.level + 1;
  const levelKey = `level${nextLevel}`;
  const costs = template.costs[levelKey];

  const affordable = await economyService.canAfford(userId, costs);
  if (!affordable) throw new ValidationError('Insufficient pillar points to upgrade this building');

  await economyService.deductCosts(userId, costs);

  const totalSpent = Object.values(costs).reduce((sum, v) => sum + (v || 0), 0);

  plot.level = nextLevel;
  plot.upgradedAt = new Date();
  block.plots.set(key, plot);

  block.totalPointsSpent = (block.totalPointsSpent || 0) + totalSpent;
  checkExpansionUnlock(block);
  await _recalculatePopulation(block);
  block.markModified('plots');
  await block.save();

  return block;
}

async function undoPlacement(userId, col, row) {
  col = parseInt(col, 10);
  row = parseInt(row, 10);
  const key = _plotKey(col, row);

  const block = await getBlock(userId);
  const plot = block.plots.get(key);
  if (!plot) throw new NotFoundError(`No building at plot ${key}`);

  // Must be within 24 hours of placement
  const hoursSincePlaced = (Date.now() - new Date(plot.placedAt).getTime()) / 3600000;
  if (hoursSincePlaced > 24) {
    throw new ForbiddenError('Undo window has expired (24 hours)');
  }

  const template = await BuildingTemplate.findById(plot.buildingTemplateId);
  if (!template) throw new NotFoundError('Building template not found');

  const costs = template.costs.level1;

  // Remove all cells occupied by this building (same buildingTemplateId + same placedAt)
  const placedAt = String(plot.placedAt);
  for (const [k, p] of block.plots) {
    if (
      String(p.buildingTemplateId) === String(plot.buildingTemplateId) &&
      String(p.placedAt) === placedAt
    ) {
      block.plots.delete(k);
    }
  }

  const totalRefund = Object.values(costs).reduce((sum, v) => sum + (v || 0), 0);
  block.totalPointsSpent = Math.max(0, (block.totalPointsSpent || 0) - totalRefund);

  await economyService.refundCosts(userId, costs);
  await _recalculatePopulation(block);
  block.markModified('plots');
  await block.save();

  return block;
}

module.exports = {
  getBlock,
  placeBuilding,
  upgradeBuilding,
  undoPlacement,
  calculatePopulation,
  checkExpansionUnlock,
};
