'use strict';

jest.mock('../src/models', () => ({
  Leaderboard: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  User: {
    find: jest.fn(),
    updateMany: jest.fn(),
  },
  Team: {
    find: jest.fn(),
  },
  Classroom: {
    find: jest.fn(),
  },
}));

const { Leaderboard, User, Team, Classroom } = require('../src/models');
const leaderboardService = require('../src/services/leaderboardService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('leaderboardService', () => {
  describe('calculateMovement', () => {
    it('returns positive when rank improved (moved up)', () => {
      expect(leaderboardService.calculateMovement(1, 3)).toBe(2);
    });

    it('returns negative when rank dropped', () => {
      expect(leaderboardService.calculateMovement(4, 2)).toBe(-2);
    });

    it('returns 0 for no change', () => {
      expect(leaderboardService.calculateMovement(2, 2)).toBe(0);
    });

    it('returns 0 when previousRank is null (new entry)', () => {
      expect(leaderboardService.calculateMovement(1, null)).toBe(0);
    });
  });

  describe('updateTeamLeaderboard', () => {
    it('sums team member points and ranks teams correctly', async () => {
      const classroomId = 'class001';

      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { teamId: 'team001', balances: { teamPoints: 20 } },
          { teamId: 'team001', balances: { teamPoints: 15 } },
          { teamId: 'team002', balances: { teamPoints: 50 } },
        ]),
      });

      Team.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: 'team001', name: 'Red Team' },
          { _id: 'team002', name: 'Blue Team' },
        ]),
      });

      Leaderboard.findOne.mockResolvedValue(null); // no previous board

      const savedBoard = { entries: [], updatedAt: new Date() };
      Leaderboard.findOneAndUpdate.mockResolvedValue(savedBoard);

      const result = await leaderboardService.updateTeamLeaderboard(classroomId);

      expect(Leaderboard.findOneAndUpdate).toHaveBeenCalledWith(
        { scope: 'team', scopeId: classroomId },
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ entityId: 'team002', rank: 1, totalTeamPoints: 50 }),
            expect.objectContaining({ entityId: 'team001', rank: 2, totalTeamPoints: 35 }),
          ]),
        }),
        { upsert: true, new: true }
      );
      expect(result).toBe(savedBoard);
    });

    it('calculates movement when previous rankings exist', async () => {
      const classroomId = 'class001';

      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { teamId: 'team001', balances: { teamPoints: 100 } },
          { teamId: 'team002', balances: { teamPoints: 50 } },
        ]),
      });

      Team.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: 'team001', name: 'Red Team' },
          { _id: 'team002', name: 'Blue Team' },
        ]),
      });

      // Previous board: team002 was rank 1, team001 was rank 2
      Leaderboard.findOne.mockResolvedValue({
        entries: [
          { entityId: 'team002', rank: 1 },
          { entityId: 'team001', rank: 2 },
        ],
      });

      Leaderboard.findOneAndUpdate.mockResolvedValue({});

      await leaderboardService.updateTeamLeaderboard(classroomId);

      const callArgs = Leaderboard.findOneAndUpdate.mock.calls[0][1];
      const team1Entry = callArgs.entries.find((e) => String(e.entityId) === 'team001');
      // team001 moved from rank 2 to rank 1 — movement = +1
      expect(team1Entry.rank).toBe(1);
      expect(team1Entry.movement).toBe(1);
    });
  });

  describe('getLeaderboard', () => {
    it('returns leaderboard when found', async () => {
      const board = { scope: 'team', scopeId: 'class001', entries: [] };
      Leaderboard.findOne.mockResolvedValue(board);

      const result = await leaderboardService.getLeaderboard('team', 'class001');
      expect(result).toBe(board);
    });

    it('throws NOT_FOUND when leaderboard does not exist', async () => {
      Leaderboard.findOne.mockResolvedValue(null);

      await expect(
        leaderboardService.getLeaderboard('team', 'class999')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
