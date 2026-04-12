'use strict';

jest.mock('../src/models', () => ({
  Team: {
    findById: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

const { Team, User } = require('../src/models');
const teamService = require('../src/services/teamService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('teamService', () => {
  describe('generateJoinCode', () => {
    it('returns a 6-character string', () => {
      const code = teamService.generateJoinCode();
      expect(code).toHaveLength(6);
    });

    it('returns only uppercase alphanumeric characters', () => {
      for (let i = 0; i < 20; i++) {
        const code = teamService.generateJoinCode();
        expect(code).toMatch(/^[A-Z0-9]+$/);
      }
    });

    it('generates unique codes across calls (probabilistic)', () => {
      const codes = new Set();
      for (let i = 0; i < 50; i++) {
        codes.add(teamService.generateJoinCode());
      }
      // With 50 calls and a large charset, should have many unique codes
      expect(codes.size).toBeGreaterThan(40);
    });
  });

  describe('createTeam', () => {
    it('creates a team with a unique join code', async () => {
      Team.findOne.mockResolvedValue(null); // no collision
      Team.create.mockResolvedValue({ _id: 'team001', name: 'Red Team', joinCode: 'ABC123' });

      const team = await teamService.createTeam('Red Team', 'class001', 'school001');
      expect(Team.create).toHaveBeenCalled();
      expect(team.name).toBe('Red Team');
    });

    it('retries join code on collision', async () => {
      // First call finds existing team (collision), second call finds none
      Team.findOne
        .mockResolvedValueOnce({ _id: 'existing' })
        .mockResolvedValue(null);
      Team.create.mockResolvedValue({ _id: 'team002', joinCode: 'XYZ789' });

      await teamService.createTeam('Blue Team', 'class001', 'school001');
      expect(Team.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('joinTeam', () => {
    const makeTeam = (overrides = {}) => ({
      _id: 'team001',
      isActive: true,
      members: [],
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    });

    const makeUser = (overrides = {}) => ({
      _id: 'user001',
      username: 'testuser',
      displayName: 'Test User',
      avatar: { spriteKey: 'default' },
      ...overrides,
    });

    it('throws NOT_FOUND if user does not exist', async () => {
      User.findById.mockResolvedValue(null);
      await expect(teamService.joinTeam('team001', 'user001')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws NOT_FOUND if team does not exist', async () => {
      User.findById.mockResolvedValue(makeUser());
      Team.findById.mockResolvedValue(null);
      await expect(teamService.joinTeam('team001', 'user001')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws VALIDATION_ERROR if team is inactive', async () => {
      User.findById.mockResolvedValue(makeUser());
      Team.findById.mockResolvedValue(makeTeam({ isActive: false }));
      await expect(teamService.joinTeam('team001', 'user001')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('throws CONFLICT if user is already a member', async () => {
      User.findById.mockResolvedValue(makeUser());
      Team.findById.mockResolvedValue(makeTeam({
        members: [{ userId: 'user001' }],
      }));
      await expect(teamService.joinTeam('team001', 'user001')).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('throws VALIDATION_ERROR if team is full (6 members)', async () => {
      User.findById.mockResolvedValue(makeUser());
      const fullMembers = Array.from({ length: 6 }, (_, i) => ({ userId: `user00${i + 2}` }));
      Team.findById.mockResolvedValue(makeTeam({ members: fullMembers }));
      await expect(teamService.joinTeam('team001', 'user001')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('adds user to team members on success', async () => {
      const user = makeUser();
      const team = makeTeam({ members: [] });
      User.findById.mockResolvedValue(user);
      Team.findById.mockResolvedValue(team);
      User.findByIdAndUpdate.mockResolvedValue({});

      await teamService.joinTeam('team001', 'user001');
      expect(team.members).toHaveLength(1);
      expect(team.members[0].userId).toBe(user._id);
      expect(team.save).toHaveBeenCalled();
    });

    it('allows up to 6 members and rejects the 7th', async () => {
      const user = makeUser();
      // Team with exactly 6 members
      const sixMembers = Array.from({ length: 6 }, (_, i) => ({ userId: `other${i}` }));
      User.findById.mockResolvedValue(user);
      Team.findById.mockResolvedValue(makeTeam({ members: sixMembers }));

      await expect(teamService.joinTeam('team001', 'user001')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });
});
