'use strict';

jest.mock('../src/models', () => ({
  User: {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
  },
  Team: {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  Classroom: {
    findById: jest.fn(),
  },
  Submission: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
  QuickRep: {
    countDocuments: jest.fn(),
  },
}));

const { User, Team, Classroom, Submission, QuickRep } = require('../src/models');
const facilitatorService = require('../src/services/facilitatorService');

// --- Chain builders ---
//
// Pattern A: find().select()   → used by inactiveStudents, imbalance users, dashboard teamPointMap users
//   select() must return a resolved Promise<array>
const makeSelectResolve = (value) => ({
  select: jest.fn().mockResolvedValue(value),
});

// Pattern B: find().select().sort()  → stale submissions
//   select() returns a chain; sort() resolves
const makeSelectSortResolve = (value) => ({
  select: jest.fn().mockReturnValue({
    sort: jest.fn().mockResolvedValue(value),
  }),
});

// Pattern C: find().select()  — for Team.find().select('name members') and Team.find().select('name')
//   same as A
const makeTeamSelectResolve = (value) => ({
  select: jest.fn().mockResolvedValue(value),
});

// Pattern D: find().distinct()
const makeDistinctResolve = (value) => ({
  distinct: jest.fn().mockResolvedValue(value),
});

// Pattern E: find().sort().skip().limit().select().lean()  (roster)
const makeRosterChain = (value) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});

// Pattern F: find().select().lean()  (Team.find for roster teamIds)
const makeSelectLeanChain = (value) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});

// Pattern G: find().sort().lean()   (Submission.find for getStudentDetail)
const makeSortLeanChain = (value) => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});

// Pattern H: findOne().select().lean()  or findById().select().lean()
const makeFindOneChain = (value) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});

// --- Fixtures ---

const makeClassroom = (overrides = {}) => ({
  _id: 'class001',
  name: 'Test Class',
  ...overrides,
});

const makeStudent = (overrides = {}) => ({
  _id: 'student001',
  username: 'student_one',
  displayName: 'Student One',
  role: 'student',
  classroomId: 'class001',
  teamId: 'team001',
  isActive: true,
  lastActiveAt: new Date(),
  balances: { teamPoints: 10, agency: 0, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
  enhancedReview: false,
  avatar: { spriteKey: 'default' },
  gifting: { receivedThisWeek: 0 },
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const makeTeam = (overrides = {}) => ({
  _id: 'team001',
  name: 'Team Alpha',
  classroomId: 'class001',
  isActive: true,
  members: [],
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();
});

// --- getAlerts call sequence (exact order) ---
//   1. User.find().select('username lastActiveAt')        → inactiveStudents   [Pattern A]
//   2. Team.find().select('name members')                 → teams              [Pattern A]
//   3. [if teams.length >= 2] User.find().select('teamId balances') → users   [Pattern A]
//   4. Submission.find().select('createdAt').sort(...)    → staleSubmissions   [Pattern B]

const setupAlerts = ({
  inactiveStudents = [],
  teams = [],
  imbalanceUsers = [],
  staleSubmissions = [],
} = {}) => {
  User.find.mockReturnValueOnce(makeSelectResolve(inactiveStudents));
  Team.find.mockReturnValueOnce(makeSelectResolve(teams));
  if (teams.length >= 2) {
    User.find.mockReturnValueOnce(makeSelectResolve(imbalanceUsers));
  }
  Submission.find.mockReturnValueOnce(makeSelectSortResolve(staleSubmissions));
};

// --- getDashboard call sequence ---
// Promise.all fires these concurrently:
//   Submission.countDocuments   → approvalQueueCount
//   Submission.countDocuments   → weeklyMissionCount
//   getAlerts(classroomId)      → (see above — runs User.find x1, Team.find x1, [User.find x1], Submission.find x1)
//   Team.find().select('name')  → teams list             [Pattern A]
// Then sequentially:
//   User.find().distinct('_id') → studentIds             [Pattern D]
//   QuickRep.countDocuments     → weeklyQuickRepCount
//   User.find().select()        → users for teamPointMap [Pattern A]

const setupDashboard = ({
  inactiveStudents = [],
  imbalanceTeams = [],
  imbalanceUsers = [],
  staleSubmissions = [],
  approvalQueueCount = 5,
  weeklyMissionCount = 12,
  dashboardTeams = [makeTeam()],
  dashboardUsers = [],
  weeklyQuickRepCount = 3,
} = {}) => {
  Classroom.findById.mockResolvedValue(makeClassroom());

  Submission.countDocuments
    .mockResolvedValueOnce(approvalQueueCount)
    .mockResolvedValueOnce(weeklyMissionCount);

  // getAlerts: inactive students
  User.find.mockReturnValueOnce(makeSelectResolve(inactiveStudents));

  // Team.find is called concurrently in Promise.all by both getAlerts and getDashboard.
  // getAlerts calls Team.find().select('name members')
  // getDashboard calls Team.find().select('name')
  // Route by the select() field argument to avoid ordering issues.
  Team.find.mockImplementation(() => ({
    select: jest.fn().mockImplementation((fields) => {
      if (fields === 'name members') return Promise.resolve(imbalanceTeams);
      return Promise.resolve(dashboardTeams);
    }),
  }));

  // getAlerts: imbalance users (only if imbalanceTeams >= 2)
  if (imbalanceTeams.length >= 2) {
    User.find.mockReturnValueOnce(makeSelectResolve(imbalanceUsers));
  }
  // getAlerts: stale submissions
  Submission.find.mockReturnValueOnce(makeSelectSortResolve(staleSubmissions));

  // dashboard post-Promise.all:
  User.find
    .mockReturnValueOnce(makeDistinctResolve([]))        // studentIds
    .mockReturnValueOnce(makeSelectResolve(dashboardUsers)); // teamPointMap users

  QuickRep.countDocuments.mockResolvedValue(weeklyQuickRepCount);
};

describe('facilitatorService', () => {
  describe('getDashboard', () => {
    it('returns correct structure with all expected fields', async () => {
      setupDashboard();

      const result = await facilitatorService.getDashboard('class001');

      expect(result).toHaveProperty('approvalQueueCount');
      expect(result).toHaveProperty('weeklyMissionCount');
      expect(result).toHaveProperty('weeklyQuickRepCount');
      expect(result).toHaveProperty('teamStandings');
      expect(result).toHaveProperty('alertCount');
    });

    it('approval queue count comes from Submission.countDocuments with pending_approval', async () => {
      setupDashboard({ approvalQueueCount: 7 });

      const result = await facilitatorService.getDashboard('class001');

      expect(result.approvalQueueCount).toBe(7);
      expect(Submission.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending_approval' })
      );
    });

    it('weekly mission count scopes to this week via completedAt $gte', async () => {
      setupDashboard({ weeklyMissionCount: 4 });

      const result = await facilitatorService.getDashboard('class001');

      expect(result.weeklyMissionCount).toBe(4);
      const calls = Submission.countDocuments.mock.calls;
      const weeklyCall = calls.find((c) => c[0].completedAt);
      expect(weeklyCall[0].completedAt.$gte).toBeInstanceOf(Date);
    });

    it('team standings sorted by totalTeamPoints descending', async () => {
      const teamA = makeTeam({ _id: 'teamA', name: 'Alpha' });
      const teamB = makeTeam({ _id: 'teamB', name: 'Beta' });
      setupDashboard({
        dashboardTeams: [teamA, teamB],
        dashboardUsers: [
          { teamId: 'teamA', balances: { teamPoints: 50 } },
          { teamId: 'teamB', balances: { teamPoints: 200 } },
        ],
      });

      const result = await facilitatorService.getDashboard('class001');

      const points = result.teamStandings.map((t) => t.totalTeamPoints);
      for (let i = 0; i < points.length - 1; i++) {
        expect(points[i]).toBeGreaterThanOrEqual(points[i + 1]);
      }
    });
  });

  describe('getAlerts', () => {
    it('detects inactive students with lastActiveAt null', async () => {
      const student = makeStudent({ _id: 'inact001', username: 'idle_student', lastActiveAt: null });
      setupAlerts({ inactiveStudents: [student] });

      const alerts = await facilitatorService.getAlerts('class001');

      const inactive = alerts.filter((a) => a.type === 'inactive_student');
      expect(inactive).toHaveLength(1);
      expect(inactive[0].username).toBe('idle_student');
      expect(inactive[0].daysSinceActive).toBeNull();
    });

    it('detects inactive students with lastActiveAt > 14 days ago', async () => {
      const oldDate = new Date(Date.now() - 20 * 86400000);
      const student = makeStudent({ _id: 'inact002', username: 'old_student', lastActiveAt: oldDate });
      setupAlerts({ inactiveStudents: [student] });

      const alerts = await facilitatorService.getAlerts('class001');

      const inactive = alerts.filter((a) => a.type === 'inactive_student');
      expect(inactive[0].daysSinceActive).toBeGreaterThanOrEqual(20);
    });

    it('detects team imbalance when max > 3x min and min > 0', async () => {
      const teamA = makeTeam({ _id: 'teamA', name: 'Alpha' });
      const teamB = makeTeam({ _id: 'teamB', name: 'Beta' });
      setupAlerts({
        teams: [teamA, teamB],
        imbalanceUsers: [
          { teamId: 'teamA', balances: { teamPoints: 10 } },
          { teamId: 'teamB', balances: { teamPoints: 400 } },
        ],
      });

      const alerts = await facilitatorService.getAlerts('class001');

      const imbalance = alerts.filter((a) => a.type === 'team_imbalance');
      expect(imbalance).toHaveLength(1);
      expect(imbalance[0].ratio).toBeGreaterThan(3);
    });

    it('does NOT flag imbalance when min is 0', async () => {
      const teamA = makeTeam({ _id: 'teamA', name: 'Alpha' });
      const teamB = makeTeam({ _id: 'teamB', name: 'Beta' });
      setupAlerts({
        teams: [teamA, teamB],
        imbalanceUsers: [
          { teamId: 'teamA', balances: { teamPoints: 0 } },
          { teamId: 'teamB', balances: { teamPoints: 500 } },
        ],
      });

      const alerts = await facilitatorService.getAlerts('class001');

      expect(alerts.filter((a) => a.type === 'team_imbalance')).toHaveLength(0);
    });

    it('detects stale queue when pending_approval submissions older than 3 days exist', async () => {
      const oldSub = { createdAt: new Date(Date.now() - 5 * 86400000) };
      setupAlerts({ staleSubmissions: [oldSub] });

      const alerts = await facilitatorService.getAlerts('class001');

      const stale = alerts.filter((a) => a.type === 'stale_queue');
      expect(stale).toHaveLength(1);
      expect(stale[0].count).toBe(1);
      expect(stale[0].oldestDate).toEqual(oldSub.createdAt);
    });

    it('returns empty array when no alerts', async () => {
      setupAlerts();

      const alerts = await facilitatorService.getAlerts('class001');

      expect(alerts).toEqual([]);
    });
  });

  describe('getStudentRoster', () => {
    // getStudentRoster call sequence:
    //   User.find().sort().skip().limit().select().lean()   → students   [Pattern E]
    //   User.countDocuments()                              → total
    //   Team.find().select().lean()                        → teams      [Pattern F]
    //   Submission.aggregate()                             → missionCounts

    it('returns paginated students with correct total and page metadata', async () => {
      const students = [makeStudent()];
      User.find.mockReturnValueOnce(makeRosterChain(students));
      User.countDocuments.mockResolvedValue(1);
      Team.find.mockReturnValueOnce(makeSelectLeanChain([]));
      Submission.aggregate.mockResolvedValue([]);

      const result = await facilitatorService.getStudentRoster('class001', { page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(Array.isArray(result.students)).toBe(true);
    });

    it('applies search filter as $or on username and displayName', async () => {
      User.find.mockReturnValueOnce(makeRosterChain([]));
      User.countDocuments.mockResolvedValue(0);
      Team.find.mockReturnValueOnce(makeSelectLeanChain([]));
      Submission.aggregate.mockResolvedValue([]);

      await facilitatorService.getStudentRoster('class001', { search: 'alice' });

      const filterArg = User.find.mock.calls[0][0];
      expect(filterArg.$or).toBeDefined();
      expect(filterArg.$or[0].username.$regex).toBe('alice');
      expect(filterArg.$or[1].displayName.$regex).toBe('alice');
    });
  });

  describe('getStudentDetail', () => {
    // getStudentDetail call sequence:
    //   User.findOne().select().lean()               → student      [Pattern H]
    //   Team.findById().select().lean()              → team         [Pattern H]
    //   Submission.find().sort().lean()              → submissions  [Pattern G]
    //   QuickRep.countDocuments x2

    it('returns profile, pillarBreakdown, missionHistory, and quickRepStats', async () => {
      const student = makeStudent({
        balances: { agency: 50, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      });
      User.findOne.mockReturnValueOnce(makeFindOneChain(student));
      Team.findById.mockReturnValueOnce(makeFindOneChain(makeTeam()));
      Submission.find.mockReturnValueOnce(makeSortLeanChain([
        { pillar: 'agency', pointsAwarded: { pillar: 'agency', pillarPoints: 50 } },
      ]));
      QuickRep.countDocuments.mockResolvedValueOnce(2).mockResolvedValueOnce(10);

      const result = await facilitatorService.getStudentDetail('student001', 'class001');

      expect(result.profile).toBeDefined();
      expect(result.pillarBreakdown).toBeDefined();
      expect(result.pillarBreakdown.agency).toBeDefined();
      expect(result.missionHistory).toBeDefined();
      expect(result.quickRepStats.thisWeek).toBe(2);
      expect(result.quickRepStats.allTime).toBe(10);
    });

    it('throws NOT_FOUND for non-existent student', async () => {
      User.findOne.mockReturnValueOnce(makeFindOneChain(null));

      await expect(
        facilitatorService.getStudentDetail('bad_id', 'class001')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('toggleEnhancedReview', () => {
    it('flips false → true', async () => {
      const student = makeStudent({ enhancedReview: false });
      User.findOne.mockResolvedValue(student);

      const result = await facilitatorService.toggleEnhancedReview('student001', 'class001');

      expect(result.enhancedReview).toBe(true);
      expect(student.save).toHaveBeenCalled();
    });

    it('flips true → false', async () => {
      const student = makeStudent({ enhancedReview: true });
      User.findOne.mockResolvedValue(student);

      const result = await facilitatorService.toggleEnhancedReview('student001', 'class001');

      expect(result.enhancedReview).toBe(false);
      expect(student.save).toHaveBeenCalled();
    });

    it('throws FORBIDDEN if student not in classroom', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        facilitatorService.toggleEnhancedReview('student001', 'wrong_class')
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('resetStudentPassword', () => {
    it('resets password and calls findByIdAndUpdate with new hash', async () => {
      User.findOne.mockResolvedValue(makeStudent());
      User.findByIdAndUpdate.mockResolvedValue({});

      await expect(
        facilitatorService.resetStudentPassword('student001', 'class001', 'new_hash_abc')
      ).resolves.toBeUndefined();

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('student001', { passwordHash: 'new_hash_abc' });
    });

    it('throws FORBIDDEN if student not in classroom', async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        facilitatorService.resetStudentPassword('student001', 'wrong_class', 'hash')
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('moveStudentTeam', () => {
    it('moves student and updates both old and new team member arrays', async () => {
      const student = makeStudent({ teamId: 'team001' });
      User.findOne.mockResolvedValue(student);
      const newTeam = makeTeam({ _id: 'team002', name: 'Beta', members: [] });
      Team.findOne.mockResolvedValue(newTeam);
      User.findByIdAndUpdate.mockResolvedValue({});
      Team.findByIdAndUpdate.mockResolvedValue({});

      const result = await facilitatorService.moveStudentTeam('student001', 'class001', 'team002');

      expect(result.newTeamId).toBe('team002');
      expect(Team.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      const calls = Team.findByIdAndUpdate.mock.calls;
      expect(calls.some((c) => c[1].$pull)).toBe(true);
      expect(calls.some((c) => c[1].$push)).toBe(true);
    });

    it('throws VALIDATION_ERROR if new team is full (>= 6 members)', async () => {
      User.findOne.mockResolvedValue(makeStudent({ teamId: 'team001' }));
      const fullTeam = makeTeam({
        _id: 'team002',
        members: [1, 2, 3, 4, 5, 6].map((i) => ({ userId: `u${i}` })),
      });
      Team.findOne.mockResolvedValue(fullTeam);

      await expect(
        facilitatorService.moveStudentTeam('student001', 'class001', 'team002')
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('throws NOT_FOUND if new team is not in same classroom', async () => {
      User.findOne.mockResolvedValue(makeStudent({ teamId: 'team001' }));
      Team.findOne.mockResolvedValue(null);

      await expect(
        facilitatorService.moveStudentTeam('student001', 'class001', 'team_other')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
