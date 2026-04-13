'use strict';

const { User, Classroom, Submission } = require('../models');
const pushService = require('./pushService');
const emailService = require('./emailService');

/**
 * Send push and/or email to a facilitator based on their notification preferences.
 *
 * @param {string} facilitatorId
 * @param {'monday_launch'|'thursday_queue'|'friday_slideshow'} type
 * @param {Object} data - context passed to email and push templates
 */
async function notifyFacilitator(facilitatorId, type, data = {}) {
  try {
    const user = await User.findById(facilitatorId).select('notificationPrefs fcmTokens').lean();
    if (!user) return;

    const prefKey = _typeToPrefKey(type);
    const prefs = (user.notificationPrefs && user.notificationPrefs[prefKey]) || {};
    const pushEnabled = prefs.push !== false;
    const emailEnabled = prefs.email !== false;

    const { title, body } = _buildPushCopy(type, data);

    const tasks = [];

    if (pushEnabled && title) {
      tasks.push(pushService.sendPush(facilitatorId, title, body, { type }));
    }

    if (emailEnabled) {
      tasks.push(emailService.sendFacilitatorReminder(facilitatorId, type, data));
    }

    await Promise.all(tasks);
  } catch (err) {
    console.error('[notificationService] notifyFacilitator error:', err.message);
  }
}

/**
 * Send a push notification to a student.
 * Students do not receive email notifications.
 *
 * @param {string} studentId
 * @param {string} title
 * @param {string} body  - must NOT include PII visible on lock screens
 * @param {Object} data  - app-internal routing data only
 */
async function notifyStudent(studentId, title, body, data = {}) {
  try {
    await pushService.sendPush(studentId, title, body, data);
  } catch (err) {
    console.error('[notificationService] notifyStudent error:', err.message);
  }
}

/**
 * Send weekly reminders to facilitators of all active classrooms.
 * Determines the appropriate reminder type from the current day of the week:
 *   Monday (1)   → monday_launch
 *   Thursday (4) → thursday_queue (only if pending Tier 3 submissions exist)
 *   Friday (5)   → friday_slideshow
 * No-ops on all other days.
 */
async function sendWeeklyReminders() {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ... 6=Sat

  try {
    const classrooms = await Classroom.find({ isActive: true }).select('_id facilitatorId').lean();

    if (!classrooms.length) return;

    await Promise.allSettled(classrooms.map((classroom) => _sendReminderForClassroom(classroom, day)));
  } catch (err) {
    console.error('[notificationService] sendWeeklyReminders error:', err.message);
  }
}

async function _sendReminderForClassroom(classroom, day) {
  const facilitatorId = String(classroom.facilitatorId);
  const classroomId = classroom._id;

  try {
    if (day === 1) {
      // Monday — launch reminder
      await notifyFacilitator(facilitatorId, 'monday_launch', {
        dashboardUrl: 'https://myblock.app/facilitator',
      });
    } else if (day === 4) {
      // Thursday — only send if there are pending Tier 3 submissions
      const pendingCount = await Submission.countDocuments({
        classroomId,
        tier: 3,
        status: 'pending_approval',
      });

      if (pendingCount > 0) {
        await notifyFacilitator(facilitatorId, 'thursday_queue', {
          pendingCount,
          reviewUrl: 'https://myblock.app/facilitator/submissions',
        });
      }
    } else if (day === 5) {
      // Friday — slideshow ready
      await notifyFacilitator(facilitatorId, 'friday_slideshow', {
        slideshowUrl: `https://myblock.app/facilitator/slideshow`,
      });
    }
    // All other days: no-op
  } catch (err) {
    console.error(
      `[notificationService] reminder error for classroom ${classroomId}:`,
      err.message
    );
  }
}

function _typeToPrefKey(type) {
  switch (type) {
    case 'monday_launch': return 'mondayLaunch';
    case 'thursday_queue': return 'thursdayQueue';
    case 'friday_slideshow': return 'fridaySlideshow';
    default: return null;
  }
}

function _buildPushCopy(type, data) {
  switch (type) {
    case 'monday_launch':
      return { title: 'Time to launch the week!', body: 'Open the app to get your class started.' };
    case 'thursday_queue':
      return {
        title: 'Submissions waiting for review',
        body: `${data.pendingCount || 'Some'} Tier 3 submission${data.pendingCount !== 1 ? 's' : ''} need your approval.`,
      };
    case 'friday_slideshow':
      return { title: 'Your weekly slideshow is ready!', body: 'See what your class accomplished this week.' };
    default:
      return { title: null, body: null };
  }
}

module.exports = { notifyFacilitator, notifyStudent, sendWeeklyReminders };
