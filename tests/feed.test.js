'use strict';

jest.mock('../src/models', () => ({
  FeedEntry: {
    create: jest.fn(),
    find: jest.fn(),
  },
  User: {
    findById: jest.fn(),
  },
}));

const { FeedEntry, User } = require('../src/models');
const feedService = require('../src/services/feedService');

const makeUser = (overrides = {}) => ({
  _id: 'user001',
  username: 'tonytest',
  displayName: 'Tony Test',
  schoolId: 'school001',
  classroomId: 'class001',
  teamId: 'team001',
  ...overrides,
});

const makeFeedEntry = (overrides = {}) => ({
  _id: 'entry001',
  schoolId: 'school001',
  classroomId: 'class001',
  teamId: 'team001',
  type: 'mission_complete',
  actorId: 'user001',
  actorUsername: 'tonytest',
  actorDisplayName: 'Tony Test',
  data: { tier: 1, pillar: 'agency' },
  visibility: 'classroom',
  createdAt: new Date('2026-04-10T10:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('feedService', () => {
  describe('createFeedEntry', () => {
    it('creates a feed entry with denormalized actor fields', async () => {
      const user = makeUser();
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });
      const expectedEntry = makeFeedEntry();
      FeedEntry.create.mockResolvedValue(expectedEntry);

      const result = await feedService.createFeedEntry(
        'mission_complete',
        'user001',
        { tier: 1, pillar: 'agency' },
        'classroom'
      );

      expect(FeedEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: user._id,
          actorUsername: user.username,
          actorDisplayName: user.displayName,
          type: 'mission_complete',
          visibility: 'classroom',
        })
      );
      expect(result).toBe(expectedEntry);
    });

    it('throws NOT_FOUND if actor user does not exist', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        feedService.createFeedEntry('gift', 'ghost001', {}, 'team')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('getFeed', () => {
    it('filters by teamId when scope=team', async () => {
      const user = makeUser();
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const mockEntries = [makeFeedEntry()];
      const sortMock = jest.fn().mockReturnThis();
      const limitMock = jest.fn().mockResolvedValue(mockEntries);
      FeedEntry.find.mockReturnValue({ sort: sortMock, limit: limitMock });

      const result = await feedService.getFeed('user001', 'team', null, 50);

      expect(FeedEntry.find).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: user.teamId })
      );
      expect(result).toBe(mockEntries);
    });

    it('filters by classroomId when scope=classroom', async () => {
      const user = makeUser();
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const sortMock = jest.fn().mockReturnThis();
      FeedEntry.find.mockReturnValue({ sort: sortMock, limit: jest.fn().mockResolvedValue([]) });

      await feedService.getFeed('user001', 'classroom', null, 20);

      expect(FeedEntry.find).toHaveBeenCalledWith(
        expect.objectContaining({ classroomId: user.classroomId })
      );
    });

    it('filters by schoolId when scope=school', async () => {
      const user = makeUser();
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      FeedEntry.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await feedService.getFeed('user001', 'school', null, 50);

      expect(FeedEntry.find).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: user.schoolId })
      );
    });

    it('applies since-based pagination via createdAt $lt', async () => {
      const user = makeUser();
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      FeedEntry.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const since = '2026-04-11T00:00:00Z';
      await feedService.getFeed('user001', 'team', since, 50);

      expect(FeedEntry.find).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: { $lt: new Date(since) },
        })
      );
    });

    it('caps limit at 100', async () => {
      const user = makeUser();
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const limitMock = jest.fn().mockResolvedValue([]);
      FeedEntry.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), limit: limitMock });

      await feedService.getFeed('user001', 'school', null, 999);

      expect(limitMock).toHaveBeenCalledWith(100);
    });
  });

  describe('createMissionCompleteFeedEntry', () => {
    it('passes denormalized tier and pillar into data', async () => {
      const user = makeUser();
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });
      FeedEntry.create.mockResolvedValue(makeFeedEntry());

      const submission = {
        userId: 'user001',
        tier: 2,
        pillar: 'helping',
        pointsAwarded: { teamPoints: 5, pillarPoints: 50 },
      };
      await feedService.createMissionCompleteFeedEntry(submission);

      expect(FeedEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mission_complete',
          data: expect.objectContaining({ tier: 2, pillar: 'helping' }),
        })
      );
    });
  });
});
