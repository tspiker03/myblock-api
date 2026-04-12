'use strict';

jest.mock('../src/models', () => ({
  QuickRep: {
    create: jest.fn(),
    countDocuments: jest.fn(),
  },
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  FeedEntry: {
    create: jest.fn(),
  },
}));

// Mock feedService to isolate quickRepService
jest.mock('../src/services/feedService', () => ({
  createFeedEntry: jest.fn().mockResolvedValue({}),
}));

const { QuickRep, User } = require('../src/models');
const quickRepService = require('../src/services/quickRepService');
const { POINT_VALUES } = require('../src/utils/constants');

const makeUser = (overrides = {}) => ({
  _id: 'user001',
  teamId: 'team001',
  schoolId: 'school001',
  username: 'tonytest',
  displayName: 'Tony Test',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('quickRepService', () => {
  describe('_isoWeekKey', () => {
    it('returns a string in YYYY-WNN format', () => {
      const key = quickRepService._isoWeekKey(new Date('2026-04-12'));
      expect(key).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('returns the same week key for two dates in the same ISO week', () => {
      // 2026-04-06 (Mon) and 2026-04-12 (Sun) are in the same ISO week
      const k1 = quickRepService._isoWeekKey(new Date('2026-04-06'));
      const k2 = quickRepService._isoWeekKey(new Date('2026-04-12'));
      expect(k1).toBe(k2);
    });
  });

  describe('logQuickRep', () => {
    it('logs a quick rep and awards correct points', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(makeUser()) });
      QuickRep.countDocuments.mockResolvedValue(0); // 0 reps this week
      QuickRep.create.mockResolvedValue({ _id: 'rep001', name: '20 pushups' });
      User.findByIdAndUpdate.mockResolvedValue({});

      const result = await quickRepService.logQuickRep('user001', '20 pushups');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user001',
        {
          $inc: {
            'balances.teamPoints': POINT_VALUES.QUICK_REP.teamPoints,
            'balances.cosmeticPoints': POINT_VALUES.QUICK_REP.cosmeticPoints,
          },
        }
      );
      expect(result.pointsAwarded.teamPoints).toBe(POINT_VALUES.QUICK_REP.teamPoints);
      expect(result.pointsAwarded.cosmeticPoints).toBe(POINT_VALUES.QUICK_REP.cosmeticPoints);
      expect(result.weeklyCount).toBe(1);
      expect(result.weeklyRemaining).toBe(quickRepService.QUICK_REP_WEEKLY_CAP - 1);
    });

    it('allows up to 4 reps per week', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(makeUser()) });
      QuickRep.countDocuments.mockResolvedValue(3); // 3 reps already logged
      QuickRep.create.mockResolvedValue({ _id: 'rep004', name: 'Read 15 min' });
      User.findByIdAndUpdate.mockResolvedValue({});

      const result = await quickRepService.logQuickRep('user001', 'Read 15 min');
      expect(result.weeklyCount).toBe(4);
      expect(result.weeklyRemaining).toBe(0);
    });

    it('rejects a 5th rep with VALIDATION_ERROR', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(makeUser()) });
      QuickRep.countDocuments.mockResolvedValue(4); // already at cap

      await expect(
        quickRepService.logQuickRep('user001', 'Stretch 5 min')
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

      expect(QuickRep.create).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND if user does not exist', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await expect(
        quickRepService.logQuickRep('ghost001', 'Drink water')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('getWeeklyCount', () => {
    it('returns count of reps for the current ISO week', async () => {
      QuickRep.countDocuments.mockResolvedValue(2);

      const count = await quickRepService.getWeeklyCount('user001');
      expect(count).toBe(2);
      expect(QuickRep.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user001' })
      );
    });
  });

  describe('QUICK_REP point values', () => {
    it('awards 0.5 team points per rep', () => {
      expect(POINT_VALUES.QUICK_REP.teamPoints).toBe(0.5);
    });

    it('awards 3 cosmetic points per rep', () => {
      expect(POINT_VALUES.QUICK_REP.cosmeticPoints).toBe(3);
    });

    it('weekly cap of 4 reps = 2 team pts max per week', () => {
      expect(quickRepService.QUICK_REP_WEEKLY_CAP * POINT_VALUES.QUICK_REP.teamPoints).toBe(2);
    });
  });
});
