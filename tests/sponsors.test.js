'use strict';

// ── Environment stubs (env.js validates JWT_SECRET at require time) ──────────
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

// ── Mock mongoose models ──────────────────────────────────────────────────────
jest.mock('../src/models', () => ({
  Sponsor: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
  Prize: {
    findById: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  },
  ThresholdDraw: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  User: {
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    updateOne: jest.fn(),
  },
  Season: {
    findOne: jest.fn(),
  },
  Submission: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
}));

// ── Mock bcryptjs so tests run fast ──────────────────────────────────────────
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

// ── Mock jsonwebtoken ─────────────────────────────────────────────────────────
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
}));

const bcrypt = require('bcryptjs');
const { Sponsor, Prize, ThresholdDraw, User, Season, Submission } = require('../src/models');
const sponsorService = require('../src/services/sponsorService');

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makeSponsor = (overrides = {}) => ({
  _id: 'sponsor001',
  businessName: 'Acme Corp',
  contactName: 'Jane Doe',
  contactEmail: 'jane@acme.com',
  passwordHash: 'hashed-password',
  status: 'approved',
  schoolIds: ['school001'],
  save: jest.fn().mockResolvedValue(true),
  toObject: jest.fn().mockReturnValue({
    _id: 'sponsor001',
    businessName: 'Acme Corp',
    contactName: 'Jane Doe',
    contactEmail: 'jane@acme.com',
    passwordHash: 'hashed-password',
    status: 'pending',
  }),
  ...overrides,
});

const makePrize = (overrides = {}) => ({
  _id: 'prize001',
  sponsorId: 'sponsor001',
  name: 'Gift Card',
  status: 'pending_approval',
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── registerSponsor ───────────────────────────────────────────────────────────
describe('registerSponsor', () => {
  it('creates a sponsor with hashed password and status pending', async () => {
    Sponsor.findOne.mockResolvedValue(null);
    const created = makeSponsor({ status: 'pending' });
    Sponsor.create.mockResolvedValue(created);

    await sponsorService.registerSponsor({
      businessName: 'Acme Corp',
      contactName: 'Jane Doe',
      contactEmail: 'jane@acme.com',
      password: 'secret123',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 12);
    expect(Sponsor.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed-password', status: 'pending' })
    );
  });

  it('returns sponsor without passwordHash', async () => {
    Sponsor.findOne.mockResolvedValue(null);
    const created = makeSponsor();
    Sponsor.create.mockResolvedValue(created);

    const result = await sponsorService.registerSponsor({
      businessName: 'Acme Corp',
      contactName: 'Jane Doe',
      contactEmail: 'jane@acme.com',
      password: 'secret123',
    });

    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws ConflictError when email already exists', async () => {
    Sponsor.findOne.mockResolvedValue(makeSponsor());

    await expect(
      sponsorService.registerSponsor({
        businessName: 'Acme Corp',
        contactName: 'Jane Doe',
        contactEmail: 'jane@acme.com',
        password: 'secret123',
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_EMAIL' });
  });
});

// ── loginSponsor ──────────────────────────────────────────────────────────────
describe('loginSponsor', () => {
  it('returns a JWT token for an approved sponsor with correct password', async () => {
    const sponsor = makeSponsor({ status: 'approved' });
    Sponsor.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(sponsor) });
    bcrypt.compare.mockResolvedValue(true);

    const result = await sponsorService.loginSponsor('jane@acme.com', 'secret123');

    expect(result).toHaveProperty('token', 'mock-jwt-token');
    expect(result.sponsor).toMatchObject({ _id: 'sponsor001', status: 'approved' });
  });

  it('throws AuthError for non-existent email', async () => {
    Sponsor.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await expect(sponsorService.loginSponsor('nobody@acme.com', 'pass'))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('throws AuthError for wrong password', async () => {
    const sponsor = makeSponsor({ status: 'approved' });
    Sponsor.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(sponsor) });
    bcrypt.compare.mockResolvedValue(false);

    await expect(sponsorService.loginSponsor('jane@acme.com', 'wrongpass'))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('throws ForbiddenError for unapproved sponsor', async () => {
    const sponsor = makeSponsor({ status: 'pending' });
    Sponsor.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(sponsor) });
    bcrypt.compare.mockResolvedValue(true);

    await expect(sponsorService.loginSponsor('jane@acme.com', 'secret123'))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── approveSponsor ────────────────────────────────────────────────────────────
describe('approveSponsor', () => {
  it('sets status to approved and records approvedBy and approvedAt', async () => {
    const sponsor = makeSponsor({ status: 'pending' });
    Sponsor.findById.mockResolvedValue(sponsor);

    const result = await sponsorService.approveSponsor('sponsor001', 'admin001');

    expect(sponsor.status).toBe('approved');
    expect(sponsor.approvedBy).toBe('admin001');
    expect(sponsor.approvedAt).toBeInstanceOf(Date);
    expect(sponsor.save).toHaveBeenCalled();
    expect(result).toBe(sponsor);
  });

  it('throws NotFoundError for non-existent sponsor', async () => {
    Sponsor.findById.mockResolvedValue(null);

    await expect(sponsorService.approveSponsor('missing', 'admin001'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getSponsorDashboard ───────────────────────────────────────────────────────
describe('getSponsorDashboard', () => {
  it('returns aggregate stats for a sponsor with sufficient students', async () => {
    Sponsor.findById.mockResolvedValue(makeSponsor());
    User.countDocuments.mockResolvedValue(15);
    Submission.countDocuments.mockResolvedValue(42);
    User.aggregate.mockResolvedValue([{ agency: 10, helping: 5, character: 7, curiosity: 3, learning: 8, problemSolving: 6 }]);
    Season.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ name: 'Spring 2025', startDate: new Date('2025-01-01'), endDate: new Date('2025-06-30') }),
      }),
    });

    const result = await sponsorService.getSponsorDashboard('sponsor001');

    expect(result.totalStudents).toBe(15);
    expect(result.totalMissionsCompleted).toBe(42);
    expect(result.pillarDistribution).toBeDefined();
    expect(result.seasonProgress).toMatchObject({ name: 'Spring 2025' });
  });

  it('returns notice and null fields when student count is below minimum group size', async () => {
    Sponsor.findById.mockResolvedValue(makeSponsor());
    User.countDocuments.mockResolvedValue(5); // below MIN_GROUP_SIZE of 10

    const result = await sponsorService.getSponsorDashboard('sponsor001');

    expect(result.totalStudents).toBeNull();
    expect(result.pillarDistribution).toBeNull();
    expect(result.notice).toMatch(/minimum group size/i);
  });

  it('never returns individual student data', async () => {
    Sponsor.findById.mockResolvedValue(makeSponsor());
    User.countDocuments.mockResolvedValue(20);
    Submission.countDocuments.mockResolvedValue(10);
    User.aggregate.mockResolvedValue([]);
    Season.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });

    const result = await sponsorService.getSponsorDashboard('sponsor001');

    // Result should only contain aggregate-level keys, no student records
    expect(result).not.toHaveProperty('students');
    expect(Array.isArray(result)).toBe(false);
  });
});

// ── createPrize ───────────────────────────────────────────────────────────────
describe('createPrize', () => {
  it('creates a prize with pending_approval status', async () => {
    Sponsor.findById.mockResolvedValue(makeSponsor());
    const prize = makePrize();
    Prize.create.mockResolvedValue(prize);

    const result = await sponsorService.createPrize('sponsor001', {
      name: 'Gift Card',
      deliveryMethod: 'digital',
      tier: 'monthly',
    });

    expect(Prize.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_approval', sponsorId: 'sponsor001' })
    );
    expect(result.status).toBe('pending_approval');
  });
});

// ── approvePrize ──────────────────────────────────────────────────────────────
describe('approvePrize', () => {
  it('sets status to approved and records approvedBy and approvedAt', async () => {
    const prize = makePrize({ status: 'pending_approval' });
    Prize.findById.mockResolvedValue(prize);

    const result = await sponsorService.approvePrize('prize001', 'admin001');

    expect(prize.status).toBe('approved');
    expect(prize.approvedBy).toBe('admin001');
    expect(prize.approvedAt).toBeInstanceOf(Date);
    expect(prize.save).toHaveBeenCalled();
    expect(result).toBe(prize);
  });

  it('throws NotFoundError when prize does not exist', async () => {
    Prize.findById.mockResolvedValue(null);

    await expect(sponsorService.approvePrize('missing', 'admin001'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getMonthlyWinner ──────────────────────────────────────────────────────────
describe('getMonthlyWinner', () => {
  it('returns the team with the highest points this month', async () => {
    Submission.aggregate.mockResolvedValue([
      { _id: 'team001', totalTeamPoints: 120, missionCount: 8 },
    ]);

    const result = await sponsorService.getMonthlyWinner('classroom001');

    expect(result.teamId).toBe('team001');
    expect(result.totalTeamPoints).toBe(120);
    expect(result.missionCount).toBe(8);
  });

  it('returns null when no submissions exist this month', async () => {
    Submission.aggregate.mockResolvedValue([]);

    const result = await sponsorService.getMonthlyWinner('classroom001');

    expect(result).toBeNull();
  });

  it('handles a tie by returning the first result from the aggregation', async () => {
    Submission.aggregate.mockResolvedValue([
      { _id: 'team001', totalTeamPoints: 100, missionCount: 5 },
      { _id: 'team002', totalTeamPoints: 100, missionCount: 5 },
    ]);

    const result = await sponsorService.getMonthlyWinner('classroom001');

    // Any winner is valid in a tie — just verify one came back
    expect(['team001', 'team002']).toContain(result.teamId);
  });
});

// ── conductThresholdDraw ──────────────────────────────────────────────────────
describe('conductThresholdDraw', () => {
  it('selects a winner from qualified students and logs the draw', async () => {
    ThresholdDraw.findOne.mockResolvedValue(null);
    User.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { _id: 'student001' },
      { _id: 'student002' },
      { _id: 'student003' },
    ]) }) });
    const createdDraw = { status: 'drawn', winnerId: 'student001', drawLog: '{}' };
    ThresholdDraw.create.mockResolvedValue(createdDraw);

    const result = await sponsorService.conductThresholdDraw('school001', 'season001');

    expect(ThresholdDraw.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'drawn', schoolId: 'school001', seasonId: 'season001' })
    );
    expect(result.status).toBe('drawn');
  });

  it('throws ValidationError when no eligible students exist', async () => {
    ThresholdDraw.findOne.mockResolvedValue(null);
    User.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });

    await expect(sponsorService.conductThresholdDraw('school001', 'season001'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ConflictError when draw is already completed', async () => {
    ThresholdDraw.findOne.mockResolvedValue({ status: 'drawn' });

    await expect(sponsorService.conductThresholdDraw('school001', 'season001'))
      .rejects.toMatchObject({ code: 'DRAW_ALREADY_DONE' });
  });
});
