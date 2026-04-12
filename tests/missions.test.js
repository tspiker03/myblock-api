'use strict';

jest.mock('../src/models', () => ({
  Submission: {
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  },
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  MissionTemplate: {
    findById: jest.fn(),
  },
}));

const { Submission, User, MissionTemplate } = require('../src/models');
const missionService = require('../src/services/missionService');
const { POINT_VALUES } = require('../src/utils/constants');

const makeSubmission = (overrides = {}) => ({
  _id: 'sub001',
  userId: 'user001',
  teamId: 'team001',
  schoolId: 'school001',
  classroomId: 'class001',
  tier: 1,
  pillar: 'agency',
  status: 'active',
  evidenceUrls: [],
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('missionService', () => {
  describe('point values', () => {
    it('tier 1 awards correct points', () => {
      expect(POINT_VALUES.TIER_1).toEqual({ teamPoints: 1, pillarPoints: 10 });
    });

    it('tier 2 awards correct points', () => {
      expect(POINT_VALUES.TIER_2).toEqual({ teamPoints: 5, pillarPoints: 50 });
    });

    it('tier 3 awards correct points', () => {
      expect(POINT_VALUES.TIER_3).toEqual({ teamPoints: 15, pillarPoints: 150 });
    });
  });

  describe('startMission', () => {
    it('throws NOT_FOUND if template does not exist', async () => {
      MissionTemplate.findById.mockResolvedValue(null);
      await expect(missionService.startMission('user001', 'tpl001')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws NOT_FOUND if user does not exist', async () => {
      MissionTemplate.findById.mockResolvedValue({ _id: 'tpl001', isActive: true, tier: 1, pillar: 'agency' });
      User.findById.mockResolvedValue(null);
      await expect(missionService.startMission('user001', 'tpl001')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('returns 409 ALREADY_LOCKED if user already has active mission', async () => {
      MissionTemplate.findById.mockResolvedValue({ _id: 'tpl001', isActive: true, tier: 1, pillar: 'agency' });
      User.findById.mockResolvedValue({ _id: 'user001', teamId: 't1', schoolId: 's1', classroomId: 'c1' });
      Submission.create.mockResolvedValue({ _id: 'sub_new' });
      User.findOneAndUpdate.mockResolvedValue(null); // atomic lock fails

      await expect(missionService.startMission('user001', 'tpl001')).rejects.toMatchObject({
        code: 'ALREADY_LOCKED',
        statusCode: 409,
      });
      expect(Submission.findByIdAndDelete).toHaveBeenCalledWith('sub_new');
    });

    it('returns submission on successful lock-in', async () => {
      const fakeSub = { _id: 'sub_new' };
      MissionTemplate.findById.mockResolvedValue({ _id: 'tpl001', isActive: true, tier: 2, pillar: 'helping' });
      User.findById.mockResolvedValue({ _id: 'user001', teamId: 't1', schoolId: 's1', classroomId: 'c1' });
      Submission.create.mockResolvedValue(fakeSub);
      User.findOneAndUpdate.mockResolvedValue({ _id: 'user001' }); // success

      const result = await missionService.startMission('user001', 'tpl001');
      expect(result).toBe(fakeSub);
    });
  });

  describe('completeMission', () => {
    it('throws NOT_FOUND if submission missing', async () => {
      Submission.findById.mockResolvedValue(null);
      await expect(missionService.completeMission('sub001', [])).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws VALIDATION_ERROR if not in active status', async () => {
      Submission.findById.mockResolvedValue(makeSubmission({ status: 'approved' }));
      await expect(missionService.completeMission('sub001', ['http://example.com/pic.jpg'])).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('sets status to pending_confirmation and saves', async () => {
      const sub = makeSubmission({ status: 'active' });
      Submission.findById.mockResolvedValue(sub);

      const result = await missionService.completeMission('sub001', ['http://example.com/pic.jpg']);
      expect(result.status).toBe('pending_confirmation');
      expect(result.evidenceUrls).toEqual(['http://example.com/pic.jpg']);
      expect(sub.save).toHaveBeenCalled();
    });
  });

  describe('confirmMission — auto-approve for tier 1/2', () => {
    it('auto-approves tier 1 on confirmation', async () => {
      const sub = makeSubmission({ status: 'pending_confirmation', tier: 1, pillar: 'agency' });
      Submission.findById.mockResolvedValue(sub);
      User.findByIdAndUpdate.mockResolvedValue({});

      const result = await missionService.confirmMission('sub001', 'confirmer001');
      expect(result.status).toBe('approved');
      expect(result.pointsAwarded.teamPoints).toBe(POINT_VALUES.TIER_1.teamPoints);
    });

    it('auto-approves tier 2 on confirmation', async () => {
      const sub = makeSubmission({ status: 'pending_confirmation', tier: 2, pillar: 'curiosity' });
      Submission.findById.mockResolvedValue(sub);
      User.findByIdAndUpdate.mockResolvedValue({});

      const result = await missionService.confirmMission('sub001', 'confirmer001');
      expect(result.status).toBe('approved');
      expect(result.pointsAwarded.pillarPoints).toBe(POINT_VALUES.TIER_2.pillarPoints);
    });

    it('sets status to pending_approval for tier 3', async () => {
      const sub = makeSubmission({ status: 'pending_confirmation', tier: 3, pillar: 'character' });
      Submission.findById.mockResolvedValue(sub);

      const result = await missionService.confirmMission('sub001', 'confirmer001');
      expect(result.status).toBe('pending_approval');
    });

    it('throws VALIDATION_ERROR if user confirms own submission', async () => {
      const sub = makeSubmission({ status: 'pending_confirmation', userId: 'user001' });
      Submission.findById.mockResolvedValue(sub);
      await expect(missionService.confirmMission('sub001', 'user001')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('abandonMission', () => {
    it('sets status to abandoned and clears activeMissionId', async () => {
      const sub = makeSubmission({ status: 'active' });
      Submission.findById.mockResolvedValue(sub);
      User.findByIdAndUpdate.mockResolvedValue({});

      const result = await missionService.abandonMission('sub001');
      expect(result.status).toBe('abandoned');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user001', { activeMissionId: null });
    });

    it('throws VALIDATION_ERROR if already approved', async () => {
      Submission.findById.mockResolvedValue(makeSubmission({ status: 'approved' }));
      await expect(missionService.abandonMission('sub001')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });
});
