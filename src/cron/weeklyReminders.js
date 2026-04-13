'use strict';

const notificationService = require('../services/notificationService');

/**
 * Run weekly facilitator reminders.
 *
 * Call this function on a schedule. The function itself checks the current
 * day of the week and sends only the appropriate reminder (Mon/Thu/Fri).
 * It is safe to call every day — it no-ops on non-reminder days.
 *
 * Wiring examples:
 *
 * Option A — node-cron (install: npm i node-cron):
 *   const cron = require('node-cron');
 *   const { runWeeklyReminders } = require('./cron/weeklyReminders');
 *   // Run at 8:00 AM every day; the function handles day-of-week logic internally.
 *   cron.schedule('0 8 * * *', runWeeklyReminders, { timezone: 'America/New_York' });
 *
 * Option B — external scheduler (Vercel Cron, GitHub Actions, etc.):
 *   Hit a protected internal endpoint that calls runWeeklyReminders().
 *   Schedule it daily at your preferred time.
 */
async function runWeeklyReminders() {
  console.log('[weeklyReminders] Running at', new Date().toISOString());
  await notificationService.sendWeeklyReminders();
  console.log('[weeklyReminders] Done');
}

module.exports = { runWeeklyReminders };
