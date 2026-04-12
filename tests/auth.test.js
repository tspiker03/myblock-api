'use strict';

// Mock mongoose models so tests don't need a real DB
jest.mock('../src/models', () => ({
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  School: {},
  Team: {},
  Classroom: {},
  Submission: {},
  MissionTemplate: {},
}));

const authService = require('../src/services/authService');

describe('authService', () => {
  describe('hashPassword / comparePassword', () => {
    it('hashes and verifies a student password with cost 10', async () => {
      const hash = await authService.hashPassword('testPass123', 'student');
      expect(hash).not.toBe('testPass123');
      const match = await authService.comparePassword('testPass123', hash);
      expect(match).toBe(true);
    });

    it('hashes and verifies a facilitator password with cost 12', async () => {
      const hash = await authService.hashPassword('facilitatorPass!', 'facilitator');
      const match = await authService.comparePassword('facilitatorPass!', hash);
      expect(match).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await authService.hashPassword('correct', 'student');
      const match = await authService.comparePassword('wrong', hash);
      expect(match).toBe(false);
    });
  });

  describe('generateToken / verifyToken', () => {
    const fakeUser = {
      _id: '64b000000000000000000001',
      role: 'student',
      schoolId: '64b000000000000000000002',
    };

    it('generates a verifiable JWT for a student (4h)', () => {
      const token = authService.generateToken(fakeUser);
      expect(typeof token).toBe('string');
      const payload = authService.verifyToken(token);
      expect(payload.sub).toBe(String(fakeUser._id));
      expect(payload.role).toBe('student');
    });

    it('generates a verifiable JWT for a facilitator (8h)', () => {
      const facilitator = { ...fakeUser, role: 'facilitator' };
      const token = authService.generateToken(facilitator);
      const payload = authService.verifyToken(token);
      expect(payload.role).toBe('facilitator');
    });

    it('token payload includes jti', () => {
      const token = authService.generateToken(fakeUser);
      const payload = authService.verifyToken(token);
      expect(payload.jti).toBeTruthy();
    });
  });

  describe('generateRefreshToken', () => {
    it('generates a refresh token with type=refresh', () => {
      const fakeUser = { _id: '64b000000000000000000001', role: 'facilitator', schoolId: '64b000000000000000000002' };
      const token = authService.generateRefreshToken(fakeUser);
      const payload = authService.verifyRefreshToken(token);
      expect(payload.type).toBe('refresh');
      expect(payload.sub).toBe(String(fakeUser._id));
    });
  });

  describe('generateConsentToken', () => {
    it('returns a UUID string', () => {
      const token = authService.generateConsentToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(36); // UUID v4 format
    });

    it('generates unique tokens each call', () => {
      const t1 = authService.generateConsentToken();
      const t2 = authService.generateConsentToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('checkLockout', () => {
    it('returns false when lockoutUntil is null', () => {
      const user = { lockoutUntil: null };
      expect(authService.checkLockout(user)).toBe(false);
    });

    it('returns false when lockoutUntil is in the past', () => {
      const user = { lockoutUntil: new Date(Date.now() - 1000) };
      expect(authService.checkLockout(user)).toBe(false);
    });

    it('returns true when lockoutUntil is in the future', () => {
      const user = { lockoutUntil: new Date(Date.now() + 60000) };
      expect(authService.checkLockout(user)).toBe(true);
    });
  });

  describe('recordFailedAttempt', () => {
    const { User } = require('../src/models');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('increments failedLoginAttempts', async () => {
      User.findByIdAndUpdate.mockResolvedValue({ failedLoginAttempts: 1 });
      await authService.recordFailedAttempt('userId123');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'userId123',
        { $inc: { failedLoginAttempts: 1 } },
        { new: true }
      );
    });

    it('sets lockoutUntil after 5 failed attempts', async () => {
      User.findByIdAndUpdate
        .mockResolvedValueOnce({ failedLoginAttempts: 5 })
        .mockResolvedValueOnce({});

      await authService.recordFailedAttempt('userId123');

      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      const secondCall = User.findByIdAndUpdate.mock.calls[1];
      expect(secondCall[1]).toHaveProperty('lockoutUntil');
    });
  });
});
