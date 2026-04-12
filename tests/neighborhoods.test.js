'use strict';

jest.mock('../src/models', () => ({
  CivicTask: {
    find: jest.fn(),
    findById: jest.fn(),
  },
  CivicTaskCompletion: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
  },
  Block: {
    find: jest.fn(),
  },
  FeedEntry: {
    create: jest.fn(),
  },
}));

// Mock feedService to avoid its User.findById dependency in unit tests
jest.mock('../src/services/feedService', () => ({
  createFeedEntry: jest.fn().mockResolvedValue({}),
  createMissionCompleteFeedEntry: jest.fn().mockResolvedValue({}),
  createGiftFeedEntry: jest.fn().mockResolvedValue({}),
  createBuildingFeedEntry: jest.fn().mockResolvedValue({}),
}));

const { CivicTask, CivicTaskCompletion, User } = require('../src/models');
const civicTaskService = require('../src/services/civicTaskService');

const makeTask = (overrides = {}) => ({
  _id: 'task001',
  name: 'Clean up litter',
  description: 'Pick up litter',
  cosmeticPointReward: 1,
  respawnMinutes: 30,
  isActive: true,
  ...overrides,
});

const makeUser = (overrides = {}) => ({
  _id: 'user001',
  username: 'tonytest',
  displayName: 'Tony Test',
  schoolId: 'school001',
  classroomId: 'class001',
  teamId: 'team001',
  balances: { cosmeticPoints: 5 },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('civicTaskService', () => {
  describe('getAvailableTasks', () => {
    it('returns all active tasks when none are on cooldown', async () => {
      const tasks = [makeTask(), makeTask({ _id: 'task002', name: 'Water garden' })];
      CivicTask.find.mockReturnValue({
        // plain mock — no chained select needed here
        then: undefined, // not a thenable
      });
      // Re-mock with direct resolution
      CivicTask.find.mockResolvedValue(tasks);

      CivicTaskCompletion.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });

      const result = await civicTaskService.getAvailableTasks('user001', 'target001');
      expect(result).toHaveLength(2);
    });

    it('filters out tasks that are on cooldown', async () => {
      const tasks = [makeTask({ _id: 'task001' }), makeTask({ _id: 'task002', name: 'Water garden' })];
      CivicTask.find.mockResolvedValue(tasks);

      // task001 is on cooldown
      CivicTaskCompletion.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([{ civicTaskId: 'task001' }]),
      });

      const result = await civicTaskService.getAvailableTasks('user001', 'target001');
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('task002');
    });
  });

  describe('completeCivicTask', () => {
    it('throws NOT_FOUND if task does not exist', async () => {
      CivicTask.findById.mockResolvedValue(null);
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(makeUser()) });

      await expect(
        civicTaskService.completeCivicTask('user001', 'ghost_task', 'target001')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws VALIDATION_ERROR if task is on cooldown', async () => {
      CivicTask.findById.mockResolvedValue(makeTask());
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(makeUser()) });

      CivicTaskCompletion.findOne.mockResolvedValue({
        nextAvailableAt: new Date(Date.now() + 60000),
      });

      await expect(
        civicTaskService.completeCivicTask('user001', 'task001', 'target001')
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('awards cosmetic points and creates completion record on success', async () => {
      const task = makeTask();
      const user = makeUser();
      CivicTask.findById.mockResolvedValue(task);
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
      CivicTaskCompletion.findOne.mockResolvedValue(null); // not on cooldown
      CivicTaskCompletion.create.mockResolvedValue({});
      User.findByIdAndUpdate.mockResolvedValue({});

      const result = await civicTaskService.completeCivicTask('user001', 'task001', 'target001');

      expect(CivicTaskCompletion.create).toHaveBeenCalled();
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user001',
        { $inc: { 'balances.cosmeticPoints': task.cosmeticPointReward } }
      );
      expect(result.cosmeticPointsAwarded).toBe(1);
    });

    it('sets nextAvailableAt to completedAt + respawnMinutes', async () => {
      const task = makeTask({ respawnMinutes: 60 });
      CivicTask.findById.mockResolvedValue(task);
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(makeUser()) });
      CivicTaskCompletion.findOne.mockResolvedValue(null);
      CivicTaskCompletion.create.mockResolvedValue({});
      User.findByIdAndUpdate.mockResolvedValue({});

      const before = Date.now();
      const result = await civicTaskService.completeCivicTask('user001', 'task001', 'target001');
      const after = Date.now();

      const expectedMin = before + 60 * 60 * 1000;
      const expectedMax = after + 60 * 60 * 1000;

      expect(result.nextAvailableAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(result.nextAvailableAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });
});
