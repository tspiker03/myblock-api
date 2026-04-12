'use strict';

jest.mock('../src/models', () => ({
  Block: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  BuildingTemplate: {
    findById: jest.fn(),
    find: jest.fn(),
  },
  User: {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }),
    }),
    findByIdAndUpdate: jest.fn(),
  },
  Team: {},
}));

// economyService depends on models too — mock its functions directly
jest.mock('../src/services/economyService', () => ({
  canAfford: jest.fn(),
  deductCosts: jest.fn(),
  refundCosts: jest.fn(),
  giftPoints: jest.fn(),
}));

const { Block, BuildingTemplate, User } = require('../src/models');
const economyService = require('../src/services/economyService');
const blockService = require('../src/services/blockService');

// Helper to create a mock block with a real Map for plots
const makeBlock = (overrides = {}) => ({
  _id: 'block001',
  userId: 'user001',
  schoolId: 'school001',
  plots: new Map(),
  population: 0,
  totalPointsSpent: 0,
  expansionUnlocked: false,
  activeEventId: null,
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const makeTemplate = (overrides = {}) => ({
  _id: 'tpl001',
  name: 'Community Garden',
  category: 'basic',
  tileSize: 1,
  isActive: true,
  maxLevel: 3,
  costs: {
    level1: { agency: 0, helping: 15, character: 0, curiosity: 10, learning: 5, problemSolving: 0 },
    level2: { agency: 0, helping: 25, character: 0, curiosity: 20, learning: 15, problemSolving: 0 },
    level3: { agency: 0, helping: 40, character: 0, curiosity: 30, learning: 25, problemSolving: 10 },
  },
  population: { level1: 2, level2: 5, level3: 8 },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('blockService', () => {
  describe('placeBuilding', () => {
    it('places a building on an empty plot', async () => {
      const template = makeTemplate();
      const block = makeBlock();

      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(block);
      BuildingTemplate.findById.mockResolvedValue(template);
      economyService.canAfford.mockResolvedValue(true);
      economyService.deductCosts.mockResolvedValue();
      BuildingTemplate.find.mockReturnValue({ select: jest.fn().mockResolvedValue([template]) });

      const result = await blockService.placeBuilding('user001', 'tpl001', 2, 3);
      expect(block.plots.get('2,3')).toBeDefined();
      expect(block.plots.get('2,3').level).toBe(1);
      expect(block.save).toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when plot is already occupied', async () => {
      const template = makeTemplate();
      const block = makeBlock();
      block.plots.set('2,3', { buildingTemplateId: 'tpl002', level: 1, placedAt: new Date() });

      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(block);
      BuildingTemplate.findById.mockResolvedValue(template);

      await expect(blockService.placeBuilding('user001', 'tpl001', 2, 3)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws VALIDATION_ERROR when out of bounds', async () => {
      const template = makeTemplate({ tileSize: 1 });

      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(makeBlock());
      BuildingTemplate.findById.mockResolvedValue(template);

      // col 10 is out of a 10x10 grid (0-9)
      await expect(blockService.placeBuilding('user001', 'tpl001', 10, 0)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws VALIDATION_ERROR when user cannot afford', async () => {
      const template = makeTemplate();
      const block = makeBlock();

      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(block);
      BuildingTemplate.findById.mockResolvedValue(template);
      economyService.canAfford.mockResolvedValue(false);

      await expect(blockService.placeBuilding('user001', 'tpl001', 0, 0)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws NOT_FOUND when template is inactive', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      BuildingTemplate.findById.mockResolvedValue(null);

      await expect(blockService.placeBuilding('user001', 'tpl001', 0, 0)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('upgradeBuilding', () => {
    it('increments building level', async () => {
      const template = makeTemplate();
      const block = makeBlock();
      block.plots.set('1,1', {
        buildingTemplateId: 'tpl001',
        level: 1,
        placedAt: new Date(),
        upgradedAt: null,
      });

      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(block);
      BuildingTemplate.findById.mockResolvedValue(template);
      economyService.canAfford.mockResolvedValue(true);
      economyService.deductCosts.mockResolvedValue();
      BuildingTemplate.find.mockReturnValue({ select: jest.fn().mockResolvedValue([template]) });

      const result = await blockService.upgradeBuilding('user001', 1, 1);
      expect(block.plots.get('1,1').level).toBe(2);
    });

    it('throws VALIDATION_ERROR when already at max level', async () => {
      const template = makeTemplate({ maxLevel: 3 });
      const block = makeBlock();
      block.plots.set('1,1', {
        buildingTemplateId: 'tpl001',
        level: 3,
        placedAt: new Date(),
        upgradedAt: null,
      });

      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(block);
      BuildingTemplate.findById.mockResolvedValue(template);

      await expect(blockService.upgradeBuilding('user001', 1, 1)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('throws NOT_FOUND when no building at plot', async () => {
      const block = makeBlock();

      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(block);

      await expect(blockService.upgradeBuilding('user001', 5, 5)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('undoPlacement', () => {
    it('removes building and refunds costs within 24h', async () => {
      const template = makeTemplate();
      const block = makeBlock();
      const recentDate = new Date(Date.now() - 1000 * 60 * 30); // 30 min ago
      block.plots.set('3,3', {
        buildingTemplateId: 'tpl001',
        level: 1,
        placedAt: recentDate,
        upgradedAt: null,
      });

      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(block);
      BuildingTemplate.findById.mockResolvedValue(template);
      economyService.refundCosts.mockResolvedValue();
      BuildingTemplate.find.mockResolvedValue([]);

      await blockService.undoPlacement('user001', 3, 3);
      expect(block.plots.has('3,3')).toBe(false);
      expect(economyService.refundCosts).toHaveBeenCalled();
    });

    it('rejects undo after 24 hours', async () => {
      const block = makeBlock();
      const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 25); // 25 hours ago
      block.plots.set('3,3', {
        buildingTemplateId: 'tpl001',
        level: 1,
        placedAt: oldDate,
        upgradedAt: null,
      });

      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(block);

      await expect(blockService.undoPlacement('user001', 3, 3)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('throws NOT_FOUND when no building at plot', async () => {
      const block = makeBlock();
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'user001', schoolId: 'school001' }) });
      Block.findOne.mockResolvedValue(block);

      await expect(blockService.undoPlacement('user001', 0, 0)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('calculatePopulation (unit)', () => {
    it('sums population contributions from plots with _populationContrib', () => {
      const block = makeBlock();
      block.plots.set('0,0', { _populationContrib: 2 });
      block.plots.set('1,0', { _populationContrib: 5 });
      block.plots.set('2,0', { _populationContrib: 0 });

      const pop = blockService.calculatePopulation(block);
      expect(pop).toBe(7);
    });

    it('returns 0 for empty block', () => {
      const block = makeBlock();
      expect(blockService.calculatePopulation(block)).toBe(0);
    });
  });

  describe('checkExpansionUnlock', () => {
    it('sets expansionUnlocked when totalPointsSpent >= 6000', () => {
      const block = makeBlock({ totalPointsSpent: 6000 });
      blockService.checkExpansionUnlock(block);
      expect(block.expansionUnlocked).toBe(true);
    });

    it('does not set expansionUnlocked below threshold', () => {
      const block = makeBlock({ totalPointsSpent: 5999 });
      blockService.checkExpansionUnlock(block);
      expect(block.expansionUnlocked).toBe(false);
    });

    it('does not toggle back once already unlocked', () => {
      const block = makeBlock({ totalPointsSpent: 100, expansionUnlocked: true });
      blockService.checkExpansionUnlock(block);
      expect(block.expansionUnlocked).toBe(true);
    });
  });
});
