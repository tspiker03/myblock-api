'use strict';

// ── Environment stubs ─────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

// ── Mock firebase-admin ───────────────────────────────────────────────────────
const mockSend = jest.fn().mockResolvedValue('msg-id');
const mockSendEachForMulticast = jest.fn().mockResolvedValue({ responses: [] });

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  messaging: jest.fn(() => ({
    send: mockSend,
    sendEachForMulticast: mockSendEachForMulticast,
  })),
  apps: { length: 0 },
}));

// ── Mock resend ───────────────────────────────────────────────────────────────
const mockEmailSend = jest.fn().mockResolvedValue({ id: 'email-id' });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockEmailSend },
  })),
}));

// ── Mock mongoose models ──────────────────────────────────────────────────────
jest.mock('../src/models', () => ({
  User: {
    findById: jest.fn(),
    find: jest.fn(),
    updateOne: jest.fn(),
  },
  Classroom: {
    find: jest.fn(),
  },
  Submission: {
    countDocuments: jest.fn(),
  },
  Sponsor: {},
  Prize: {},
  ThresholdDraw: {},
  Season: {},
}));

// ── Stub config so Firebase + Resend are enabled ──────────────────────────────
jest.mock('../src/config/env', () => ({
  jwtSecret: 'test-jwt-secret',
  jwtRefreshSecret: 'test-refresh-secret',
  fcmProjectId: 'fake-project',
  fcmClientEmail: 'fake@fake.iam.gserviceaccount.com',
  fcmPrivateKey: 'fake-key',
  resendApiKey: 'fake-resend-key',
  resendFromEmail: 'MyBlock <notifications@myblock.app>',
}));

const { User, Classroom, Submission } = require('../src/models');

// Services must be required AFTER all mocks are in place
const pushService = require('../src/services/pushService');
const emailService = require('../src/services/emailService');
const notificationService = require('../src/services/notificationService');

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makeUser = (overrides = {}) => ({
  _id: 'user001',
  email: 'facilitator@school.edu',
  displayName: 'Ms. Rivera',
  fcmTokens: ['token-a', 'token-b'],
  notificationPrefs: {},
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: updateOne succeeds (used by pruneTokens)
  User.updateOne.mockResolvedValue({});
});

// ── pushService.sendPush ──────────────────────────────────────────────────────
describe('pushService.sendPush', () => {
  it('sends to all FCM tokens for the user', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser()) }) });

    await pushService.sendPush('user001', 'Hello', 'World');

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ token: 'token-a' }));
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ token: 'token-b' }));
  });

  it('removes invalid tokens from user after send failure', async () => {
    const invalidTokenError = { code: 'messaging/registration-token-not-registered' };
    mockSend
      .mockResolvedValueOnce('msg-id')           // token-a succeeds
      .mockRejectedValueOnce(invalidTokenError);  // token-b is invalid

    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser()) }) });

    await pushService.sendPush('user001', 'Hello', 'World');

    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'user001' },
      { $pull: { fcmTokens: { $in: ['token-b'] } } }
    );
  });

  it('does not throw on send failure (fire-and-forget)', async () => {
    mockSend.mockRejectedValue(new Error('network error'));
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser()) }) });

    await expect(pushService.sendPush('user001', 'Hi', 'There')).resolves.toBeUndefined();
  });

  it('handles user with no FCM tokens gracefully', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser({ fcmTokens: [] })) }) });

    await pushService.sendPush('user001', 'Hi', 'There');

    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ── pushService.sendPushToMany ────────────────────────────────────────────────
describe('pushService.sendPushToMany', () => {
  it('sends to all tokens across multiple users', async () => {
    const users = [
      { _id: 'user001', fcmTokens: ['token-a'] },
      { _id: 'user002', fcmTokens: ['token-b', 'token-c'] },
    ];
    User.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(users) }) });
    mockSendEachForMulticast.mockResolvedValue({ responses: [
      { success: true },
      { success: true },
      { success: true },
    ] });

    await pushService.sendPushToMany(['user001', 'user002'], 'Batch', 'Message');

    expect(mockSendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: ['token-a', 'token-b', 'token-c'] })
    );
  });

  it('prunes invalid tokens after multicast failure', async () => {
    const users = [{ _id: 'user001', fcmTokens: ['token-a', 'token-b'] }];
    User.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(users) }) });
    mockSendEachForMulticast.mockResolvedValue({ responses: [
      { success: true },
      { success: false, error: { code: 'messaging/invalid-registration-token' } },
    ] });

    await pushService.sendPushToMany(['user001'], 'Batch', 'Message');

    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'user001' },
      { $pull: { fcmTokens: { $in: ['token-b'] } } }
    );
  });
});

// ── emailService.sendEmail ────────────────────────────────────────────────────
describe('emailService.sendEmail', () => {
  it('sends an email via Resend', async () => {
    await emailService.sendEmail('recipient@example.com', 'Test Subject', '<p>Hello</p>');

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@example.com',
        subject: 'Test Subject',
      })
    );
  });

  it('does not throw on Resend failure (fire-and-forget)', async () => {
    mockEmailSend.mockRejectedValueOnce(new Error('Resend API error'));

    await expect(
      emailService.sendEmail('recipient@example.com', 'Subject', '<p>Hi</p>')
    ).resolves.toBeUndefined();
  });
});

// ── emailService.sendFacilitatorReminder ─────────────────────────────────────
describe('emailService.sendFacilitatorReminder', () => {
  it('sends the correct template for monday_launch', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser()) }) });

    await emailService.sendFacilitatorReminder('user001', 'monday_launch', {});

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Time to launch the week!' })
    );
  });

  it('sends the correct template for thursday_queue', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser()) }) });

    await emailService.sendFacilitatorReminder('user001', 'thursday_queue', { pendingCount: 3 });

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Tier 3 submissions waiting for review' })
    );
  });

  it('sends the correct template for friday_slideshow', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser()) }) });

    await emailService.sendFacilitatorReminder('user001', 'friday_slideshow', {});

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Your weekly slideshow is ready!' })
    );
  });

  it('skips if facilitator has no email', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser({ email: null })) }) });

    await emailService.sendFacilitatorReminder('user001', 'monday_launch', {});

    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

// ── notificationService.notifyFacilitator ────────────────────────────────────
describe('notificationService.notifyFacilitator', () => {
  it('sends push and email when both are enabled (default prefs)', async () => {
    const user = makeUser({ notificationPrefs: {} });
    User.findById
      // First call: notifyFacilitator fetches user prefs
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(user) }) })
      // Second call: sendPush fetches fcmTokens
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(user) }) })
      // Third call: sendFacilitatorReminder fetches email
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(user) }) });

    await notificationService.notifyFacilitator('user001', 'monday_launch', {});

    expect(mockSend).toHaveBeenCalled();
    expect(mockEmailSend).toHaveBeenCalled();
  });

  it('skips push when push is disabled in prefs', async () => {
    const user = makeUser({ notificationPrefs: { mondayLaunch: { push: false, email: true } } });
    User.findById
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(user) }) })
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(user) }) });

    await notificationService.notifyFacilitator('user001', 'monday_launch', {});

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockEmailSend).toHaveBeenCalled();
  });

  it('skips email when email is disabled in prefs', async () => {
    const user = makeUser({ notificationPrefs: { mondayLaunch: { push: true, email: false } } });
    User.findById
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(user) }) })
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(user) }) });

    await notificationService.notifyFacilitator('user001', 'monday_launch', {});

    expect(mockSend).toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

// ── notificationService.notifyStudent ────────────────────────────────────────
describe('notificationService.notifyStudent', () => {
  it('sends push only — no email for students', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(makeUser()) }) });

    await notificationService.notifyStudent('user001', 'Achievement Unlocked', 'You earned a badge!');

    expect(mockSend).toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

// ── notificationService.sendWeeklyReminders ──────────────────────────────────
describe('notificationService.sendWeeklyReminders', () => {
  const classrooms = [{ _id: 'cls001', facilitatorId: 'user001' }];

  const stubUserForNotify = (user) => {
    // notifyFacilitator → User.findById (prefs), sendPush → User.findById (tokens), sendFacilitatorReminder → User.findById (email)
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(user) }) });
  };

  it('sends monday_launch reminders on Monday (day 1)', async () => {
    jest.spyOn(global, 'Date').mockImplementation(() => ({ getDay: () => 1 }));
    Classroom.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(classrooms) }) });
    stubUserForNotify(makeUser());

    await notificationService.sendWeeklyReminders();

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Time to launch the week!' })
    );

    jest.restoreAllMocks();
  });

  it('sends thursday_queue reminders on Thursday only when pending count > 0', async () => {
    jest.spyOn(global, 'Date').mockImplementation(() => ({ getDay: () => 4 }));
    Classroom.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(classrooms) }) });
    Submission.countDocuments.mockResolvedValue(3);
    stubUserForNotify(makeUser());

    await notificationService.sendWeeklyReminders();

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Tier 3 submissions waiting for review' })
    );

    jest.restoreAllMocks();
  });

  it('skips thursday_queue reminder when pending count is 0', async () => {
    jest.spyOn(global, 'Date').mockImplementation(() => ({ getDay: () => 4 }));
    Classroom.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(classrooms) }) });
    Submission.countDocuments.mockResolvedValue(0);

    await notificationService.sendWeeklyReminders();

    expect(mockEmailSend).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('sends friday_slideshow reminders on Friday (day 5)', async () => {
    jest.spyOn(global, 'Date').mockImplementation(() => ({ getDay: () => 5 }));
    Classroom.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(classrooms) }) });
    stubUserForNotify(makeUser());

    await notificationService.sendWeeklyReminders();

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Your weekly slideshow is ready!' })
    );

    jest.restoreAllMocks();
  });

  it('sends no reminders on other days (e.g. Wednesday, day 3)', async () => {
    jest.spyOn(global, 'Date').mockImplementation(() => ({ getDay: () => 3 }));
    Classroom.find.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(classrooms) }) });

    await notificationService.sendWeeklyReminders();

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
