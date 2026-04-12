'use strict';

jest.mock('../src/models', () => ({
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  Team: {},
}));

const { User } = require('../src/models');
const economyService = require('../src/services/economyService');

const makeUser = (overrides = {}) => ({
  _id: 'user001',
  teamId: 'team001',
  balances: {
    agency: 100,
    helping: 100,
    character: 100,
    curiosity: 100,
    learning: 100,
    problemSolving: 100,
  },
  gifting: { receivedThisWeek: 0, weekKey: null },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('economyService', () => {
  describe('canAfford', () => {
    it('returns true when user has sufficient balance in all pillars', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(makeUser()) });
      const result = await economyService.canAfford('user001', {
        agency: 10,
        helping: 20,
        character: 0,
        curiosity: 30,
        learning: 0,
        problemSolving: 0,
      });
      expect(result).toBe(true);
    });

    it('returns false when user is short on one pillar', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(makeUser({ balances: { helping: 5 } })) });
      const result = await economyService.canAfford('user001', {
        agency: 0,
        helping: 10,
        character: 0,
        curiosity: 0,
        learning: 0,
        problemSolving: 0,
      });
      expect(result).toBe(false);
    });

    it('returns true when costs are all zero', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(makeUser({ balances: {} })) });
      const result = await economyService.canAfford('user001', {
        agency: 0,
        helping: 0,
        character: 0,
        curiosity: 0,
        learning: 0,
        problemSolving: 0,
      });
      expect(result).toBe(true);
    });
  });

  describe('giftPoints', () => {
    it('transfers points from sender to recipient on same team', async () => {
      const sender = makeUser({ _id: 'sender01' });
      const recipient = makeUser({ _id: 'recip001', teamId: 'team001' });

      User.findById
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce(recipient);
      User.findByIdAndUpdate.mockResolvedValue({});

      const result = await economyService.giftPoints('sender01', 'recip001', 'helping', 10);
      expect(result).toMatchObject({ pillar: 'helping', amount: 10 });
      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('rejects gift to user on a different team', async () => {
      const sender = makeUser({ _id: 'sender01', teamId: 'team001' });
      const recipient = makeUser({ _id: 'recip001', teamId: 'team999' });

      User.findById
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce(recipient);

      await expect(
        economyService.giftPoints('sender01', 'recip001', 'helping', 5)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects gift when sender has insufficient balance', async () => {
      const sender = makeUser({ _id: 'sender01', balances: { helping: 3 } });
      const recipient = makeUser({ _id: 'recip001', teamId: 'team001' });

      User.findById
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce(recipient);

      await expect(
        economyService.giftPoints('sender01', 'recip001', 'helping', 10)
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects gift that would push recipient over weekly cap (30 pts)', async () => {
      // Compute the current week key the same way the service does
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

      const sender = makeUser({ _id: 'sender01' });
      const recipient = makeUser({
        _id: 'recip001',
        teamId: 'team001',
        gifting: { receivedThisWeek: 25, weekKey },
      });

      User.findById
        .mockResolvedValueOnce(sender)
        .mockResolvedValueOnce(recipient);

      // Giving 10 would bring total to 35, over the 30 cap
      await expect(
        economyService.giftPoints('sender01', 'recip001', 'helping', 10)
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects invalid pillar name', async () => {
      await expect(
        economyService.giftPoints('sender01', 'recip001', 'invalid_pillar', 5)
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects non-integer amount', async () => {
      await expect(
        economyService.giftPoints('sender01', 'recip001', 'helping', 3.5)
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects amount of zero', async () => {
      await expect(
        economyService.giftPoints('sender01', 'recip001', 'helping', 0)
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('deductCosts / refundCosts', () => {
    it('calls findByIdAndUpdate with negative $inc for each nonzero pillar', async () => {
      User.findByIdAndUpdate.mockResolvedValue({});
      await economyService.deductCosts('user001', {
        agency: 0,
        helping: 10,
        character: 0,
        curiosity: 5,
        learning: 0,
        problemSolving: 0,
      });
      const call = User.findByIdAndUpdate.mock.calls[0];
      expect(call[1].$inc['balances.helping']).toBe(-10);
      expect(call[1].$inc['balances.curiosity']).toBe(-5);
      expect(call[1].$inc['balances.agency']).toBeUndefined();
    });

    it('calls findByIdAndUpdate with positive $inc for each nonzero pillar on refund', async () => {
      User.findByIdAndUpdate.mockResolvedValue({});
      await economyService.refundCosts('user001', {
        agency: 0,
        helping: 10,
        character: 0,
        curiosity: 5,
        learning: 0,
        problemSolving: 0,
      });
      const call = User.findByIdAndUpdate.mock.calls[0];
      expect(call[1].$inc['balances.helping']).toBe(10);
      expect(call[1].$inc['balances.curiosity']).toBe(5);
    });
  });
});
