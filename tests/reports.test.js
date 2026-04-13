'use strict';

// Chainable query builder factory used by mocks
const makeQuery = (resolvedValue) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  then(resolve, reject) {
    return Promise.resolve(resolvedValue).then(resolve, reject);
  },
});

jest.mock('../src/models', () => ({
  Submission: {
    find: jest.fn(),
    aggregate: jest.fn(),
  },
  User: {
    find: jest.fn(),
    findById: jest.fn(),
  },
  Team: {
    find: jest.fn(),
  },
  QuickRep: {
    aggregate: jest.fn(),
  },
  Leaderboard: {
    findOne: jest.fn(),
  },
  Season: {
    findById: jest.fn(),
  },
  Classroom: {
    findById: jest.fn(),
  },
  MissionTemplate: {},
  FeedEntry: {
    aggregate: jest.fn(),
  },
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    Types: {
      ...actual.Types,
      ObjectId: {
        createFromHexString: jest.fn((id) => id),
      },
    },
  };
});

const { Submission, User, Team, QuickRep, Leaderboard, Season, Classroom, FeedEntry } = require('../src/models');
const reportService = require('../src/services/reportService');

const PILLARS = ['agency', 'helping', 'character', 'curiosity', 'learning', 'problemSolving'];

// --- Fixtures ---

const makeClassroom = (overrides = {}) => ({
  _id: 'class001',
  name: 'Test Classroom',
  seasonId: 'season001',
  schoolId: 'school001',
  ...overrides,
});

const makeSeason = (overrides = {}) => {
  const now = new Date();
  return {
    _id: 'season001',
    name: 'Season 1',
    startDate: new Date(now.getTime() - 30 * 86400000),
    endDate: new Date(now.getTime() + 30 * 86400000),
    ...overrides,
  };
};

// Team.find().select() and User.find().select() both need chain support
const makeSelectQuery = (resolvedValue) => ({
  select: jest.fn().mockResolvedValue(resolvedValue),
});

beforeEach(() => {
  jest.resetAllMocks();
});

describe('reportService', () => {
  describe('getPillarDistribution', () => {
    const setupPillarMocks = ({ classAgg = [], teamAgg = [], studentAgg = [], teams = [], users = [] } = {}) => {
      Submission.aggregate
        .mockResolvedValueOnce(classAgg)
        .mockResolvedValueOnce(teamAgg)
        .mockResolvedValueOnce(studentAgg);
      Team.find.mockReturnValueOnce(makeSelectQuery(teams));
      User.find.mockReturnValueOnce(makeSelectQuery(users));
    };

    it('returns classTotal with all 6 pillars summed', async () => {
      setupPillarMocks({
        classAgg: [{ _id: 'agency', total: 150 }, { _id: 'helping', total: 80 }],
      });

      const result = await reportService.getPillarDistribution('aaaaaaaaaaaaaaaaaaaaaaaa', null);

      for (const pillar of PILLARS) {
        expect(result.classTotal).toHaveProperty(pillar);
      }
      expect(result.classTotal.agency).toBe(150);
      expect(result.classTotal.helping).toBe(80);
      expect(result.classTotal.character).toBe(0);
    });

    it('returns byTeam breakdown with team names', async () => {
      setupPillarMocks({
        teamAgg: [{ _id: { teamId: 'team001', pillar: 'agency' }, total: 200 }],
        teams: [{ _id: { toString: () => 'team001' }, name: 'Alpha' }],
      });

      const result = await reportService.getPillarDistribution('aaaaaaaaaaaaaaaaaaaaaaaa', null);

      expect(Array.isArray(result.byTeam)).toBe(true);
      expect(result.byTeam[0].teamId).toBe('team001');
      expect(result.byTeam[0].teamName).toBe('Alpha');
      expect(result.byTeam[0].agency).toBe(200);
    });

    it('returns byStudent breakdown with usernames', async () => {
      setupPillarMocks({
        studentAgg: [{ _id: { userId: 'user001', pillar: 'curiosity' }, total: 50 }],
        users: [{ _id: { toString: () => 'user001' }, username: 'student_a' }],
      });

      const result = await reportService.getPillarDistribution('aaaaaaaaaaaaaaaaaaaaaaaa', null);

      expect(Array.isArray(result.byStudent)).toBe(true);
      expect(result.byStudent[0].userId).toBe('user001');
      expect(result.byStudent[0].username).toBe('student_a');
      expect(result.byStudent[0].curiosity).toBe(50);
    });

    it('generates insight identifying the lowest pillar', async () => {
      setupPillarMocks({
        classAgg: [
          { _id: 'agency', total: 500 },
          { _id: 'helping', total: 300 },
          { _id: 'character', total: 100 },
          { _id: 'curiosity', total: 400 },
          { _id: 'learning', total: 200 },
          { _id: 'problemSolving', total: 600 },
        ],
      });

      const result = await reportService.getPillarDistribution('aaaaaaaaaaaaaaaaaaaaaaaa', null);

      // character = 100 is the lowest
      expect(result.insight).toMatch(/[Cc]haracter/);
    });

    it('handles empty date range with no submissions gracefully', async () => {
      setupPillarMocks();

      const result = await reportService.getPillarDistribution('aaaaaaaaaaaaaaaaaaaaaaaa', {
        start: new Date(Date.now() - 7 * 86400000),
        end: new Date(),
      });

      for (const pillar of PILLARS) {
        expect(result.classTotal[pillar]).toBe(0);
      }
      expect(result.byTeam).toEqual([]);
      expect(result.byStudent).toEqual([]);
      expect(typeof result.insight).toBe('string');
    });
  });

  describe('getExportData', () => {
    const setupExportMocks = ({
      submissionAgg = [],
      users = [],
      teams = [],
      qrAgg = [],
      giftAgg = [],
    } = {}) => {
      Submission.aggregate.mockResolvedValueOnce(submissionAgg);
      User.find.mockReturnValueOnce(makeSelectQuery(users));
      Team.find.mockReturnValueOnce(makeSelectQuery(teams));
      QuickRep.aggregate.mockResolvedValueOnce(qrAgg);
      FeedEntry.aggregate.mockResolvedValueOnce(giftAgg);
    };

    const makeSubmissionRow = (overrides = {}) => ({
      _id: 'user001',
      teamId: 'team001',
      tier1: 2,
      tier2: 1,
      tier3: 0,
      totalTeamPts: 7,
      agency: 30,
      helping: 0,
      character: 0,
      curiosity: 0,
      learning: 0,
      problemSolving: 0,
      ...overrides,
    });

    it('returns CSV format with correct column headers', async () => {
      setupExportMocks({
        submissionAgg: [makeSubmissionRow()],
        users: [{ _id: { toString: () => 'user001' }, username: 'student_a', teamId: 'team001' }],
        teams: [{ _id: { toString: () => 'team001' }, name: 'Alpha' }],
      });

      const result = await reportService.getExportData('aaaaaaaaaaaaaaaaaaaaaaaa', null, 'csv');

      expect(result.csv).toBeDefined();
      const [headerLine, dataLine] = result.csv.split('\n');
      const headers = headerLine.split(',');
      expect(headers).toContain('username');
      expect(headers).toContain('team');
      expect(headers).toContain('missionsCompleted_t1');
      expect(headers).toContain('missionsCompleted_t2');
      expect(headers).toContain('missionsCompleted_t3');
      expect(headers).toContain('totalTeamPts');
      expect(headers).toContain('quickRepCount');
      expect(headers).toContain('giftsGiven');
      expect(headers).toContain('giftsReceived');
      expect(dataLine).toContain('student_a');
    });

    it('returns JSON format with classOverview, teamRankings, and studentSummaryTable', async () => {
      setupExportMocks({
        submissionAgg: [makeSubmissionRow()],
        users: [{ _id: { toString: () => 'user001' }, username: 'student_a', teamId: 'team001' }],
        teams: [{ _id: { toString: () => 'team001' }, name: 'Alpha' }],
      });

      const result = await reportService.getExportData('aaaaaaaaaaaaaaaaaaaaaaaa', null, 'json');

      expect(result.classOverview).toBeDefined();
      expect(result.classOverview).toHaveProperty('totalMissions');
      expect(result.classOverview).toHaveProperty('pillarTotals');
      expect(Array.isArray(result.teamRankings)).toBe(true);
      expect(result.teamRankings[0]).toHaveProperty('rank');
      expect(Array.isArray(result.studentSummaryTable)).toBe(true);
    });

    it('handles classroom with no students — returns empty arrays', async () => {
      setupExportMocks();

      const result = await reportService.getExportData('aaaaaaaaaaaaaaaaaaaaaaaa', null, 'json');

      expect(result.studentSummaryTable).toEqual([]);
      expect(result.teamRankings).toEqual([]);
      expect(result.classOverview.totalMissions).toBe(0);
    });
  });

  describe('generateSlideshowData', () => {
    // Slideshow: Classroom.findById().select(), Leaderboard.findOne(),
    // Submission.find().sort().limit().populate().populate(), Submission.aggregate() x2,
    // User.findById() (star student), Season.findById()

    const setupSlideshowMocks = ({
      classroom = makeClassroom(),
      leaderboard = null,
      submissions = [],
      pillarAgg = [],
      starAgg = [],
      starUser = null,
      season = makeSeason(),
    } = {}) => {
      Classroom.findById.mockReturnValueOnce(makeSelectQuery(classroom));
      Leaderboard.findOne.mockResolvedValueOnce(leaderboard);

      const subFind = makeQuery(submissions);
      Submission.find.mockReturnValueOnce(subFind);

      Submission.aggregate
        .mockResolvedValueOnce(pillarAgg)
        .mockResolvedValueOnce(starAgg);

      if (starUser) {
        User.findById.mockReturnValueOnce(makeSelectQuery(starUser));
      }

      if (classroom && classroom.seasonId) {
        Season.findById.mockResolvedValueOnce(season);
      }
    };

    it('returns all 8 slides in correct order', async () => {
      setupSlideshowMocks();

      const slides = await reportService.generateSlideshowData('aaaaaaaaaaaaaaaaaaaaaaaa');

      expect(slides).toHaveLength(8);
      expect(slides[0].type).toBe('title');
      expect(slides[1].type).toBe('leaderboard');
      expect(slides[2].type).toBe('mission_highlight');
      expect(slides[3].type).toBe('mission_highlight');
      expect(slides[4].type).toBe('mission_highlight');
      expect(slides[5].type).toBe('pillar_chart');
      expect(slides[6].type).toBe('star_student');
      expect(slides[7].type).toBe('season_progress');
    });

    it('title slide has correct week number and class name', async () => {
      setupSlideshowMocks();

      const slides = await reportService.generateSlideshowData('aaaaaaaaaaaaaaaaaaaaaaaa');
      const titleSlide = slides[0];

      expect(titleSlide.content.className).toBe('Test Classroom');
      expect(typeof titleSlide.content.weekNumber).toBe('number');
      expect(titleSlide.content.weekNumber).toBeGreaterThan(0);
      expect(titleSlide.title).toContain('Test Classroom');
      expect(titleSlide.title).toContain('Week');
    });

    it('leaderboard slide has teams sorted by rank from leaderboard entries', async () => {
      setupSlideshowMocks({
        leaderboard: {
          entries: [
            { entityName: 'Alpha', totalTeamPoints: 300, rank: 1, movement: 2 },
            { entityName: 'Beta', totalTeamPoints: 150, rank: 2, movement: -1 },
          ],
        },
      });

      const slides = await reportService.generateSlideshowData('aaaaaaaaaaaaaaaaaaaaaaaa');
      const lbSlide = slides[1];

      expect(lbSlide.content.teams).toHaveLength(2);
      expect(lbSlide.content.teams[0].rank).toBe(1);
      expect(lbSlide.content.teams[0].name).toBe('Alpha');
      expect(lbSlide.content.teams[1].rank).toBe(2);
    });

    it('mission highlights sort by tier descending to prefer Tier 3', async () => {
      setupSlideshowMocks();

      await reportService.generateSlideshowData('aaaaaaaaaaaaaaaaaaaaaaaa');

      const sortCall = Submission.find.mock.results[0].value.sort.mock.calls[0][0];
      expect(sortCall.tier).toBe(-1);
    });

    it('star student slide shows highest points this week', async () => {
      setupSlideshowMocks({
        starAgg: [{
          _id: 'user001',
          totalPoints: 200,
          agency: 200,
          helping: 0,
          character: 0,
          curiosity: 0,
          learning: 0,
          problemSolving: 0,
        }],
        starUser: { username: 'topstudent', displayName: 'Top Student' },
      });

      const slides = await reportService.generateSlideshowData('aaaaaaaaaaaaaaaaaaaaaaaa');
      const starSlide = slides[6];

      expect(starSlide.type).toBe('star_student');
      expect(starSlide.content).not.toBeNull();
      expect(starSlide.content.totalPointsThisWeek).toBe(200);
      expect(starSlide.content.topPillar).toBe('agency');
    });

    it('returns null content slides when no submissions this week', async () => {
      setupSlideshowMocks({ submissions: [], starAgg: [] });

      const slides = await reportService.generateSlideshowData('aaaaaaaaaaaaaaaaaaaaaaaa');

      // mission highlights padded with null content
      expect(slides[2].content).toBeNull();
      expect(slides[3].content).toBeNull();
      expect(slides[4].content).toBeNull();
      // star student has no data
      expect(slides[6].content).toBeNull();
    });

    it('throws NOT_FOUND when classroom does not exist', async () => {
      Classroom.findById.mockReturnValueOnce(makeSelectQuery(null));

      await expect(
        reportService.generateSlideshowData('aaaaaaaaaaaaaaaaaaaaaaaa')
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
