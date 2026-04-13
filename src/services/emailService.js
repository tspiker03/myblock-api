'use strict';

const config = require('../config/env');
const { User } = require('../models');

let _resend = null;

function getResend() {
  if (_resend) return _resend;

  if (!config.resendApiKey) {
    console.warn('[emailService] Resend not configured — email notifications disabled');
    return null;
  }

  try {
    const { Resend } = require('resend');
    _resend = new Resend(config.resendApiKey);
    return _resend;
  } catch (err) {
    console.error('[emailService] Resend init error:', err.message);
    return null;
  }
}

/**
 * Send a transactional email via Resend.
 * Fire-and-forget — never throws.
 *
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 */
async function sendEmail(to, subject, html) {
  const resend = getResend();
  if (!resend || !to) return;

  try {
    await resend.emails.send({
      from: config.resendFromEmail,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[emailService] sendEmail error:', err.message);
  }
}

/**
 * Send a role-specific reminder email to a facilitator.
 * Fire-and-forget — never throws.
 *
 * @param {string} facilitatorId
 * @param {'monday_launch'|'thursday_queue'|'friday_slideshow'} type
 * @param {Object} data  - context for the email body
 */
async function sendFacilitatorReminder(facilitatorId, type, data = {}) {
  try {
    const user = await User.findById(facilitatorId).select('email displayName').lean();
    if (!user || !user.email) return;

    const { subject, html } = _buildFacilitatorEmail(type, user.displayName, data);
    if (!subject) {
      console.warn('[emailService] Unknown facilitator reminder type:', type);
      return;
    }

    await sendEmail(user.email, subject, html);
  } catch (err) {
    console.error('[emailService] sendFacilitatorReminder error:', err.message);
  }
}

function _buildFacilitatorEmail(type, displayName, data) {
  const name = displayName || 'Facilitator';

  switch (type) {
    case 'monday_launch': {
      const subject = 'Time to launch the week!';
      const html = `
        <p>Hi ${_esc(name)},</p>
        <p>A new week is starting in MyBlock. Head to your dashboard to launch this week's missions and keep your students engaged.</p>
        ${data.leaderboardSummary ? `<p><strong>Last week's leaderboard:</strong><br>${_esc(data.leaderboardSummary)}</p>` : ''}
        <p>Don't forget to feature a mission that inspires your class this week!</p>
        <p><a href="${_esc(data.dashboardUrl || 'https://myblock.app/facilitator')}">Open your dashboard →</a></p>
        <p>— The MyBlock Team</p>
      `;
      return { subject, html };
    }

    case 'thursday_queue': {
      const count = data.pendingCount || 0;
      const subject = 'Tier 3 submissions waiting for review';
      const html = `
        <p>Hi ${_esc(name)},</p>
        <p>You have <strong>${count} Tier 3 submission${count !== 1 ? 's' : ''}</strong> waiting for your review.</p>
        <p>Students are waiting to hear back — take a few minutes to approve or provide feedback before the week wraps up.</p>
        <p><a href="${_esc(data.reviewUrl || 'https://myblock.app/facilitator/submissions')}">Review submissions →</a></p>
        <p>— The MyBlock Team</p>
      `;
      return { subject, html };
    }

    case 'friday_slideshow': {
      const subject = 'Your weekly slideshow is ready!';
      const html = `
        <p>Hi ${_esc(name)},</p>
        <p>This week's community slideshow is ready to share with your class. It highlights student achievements and team progress from the week.</p>
        <p><a href="${_esc(data.slideshowUrl || 'https://myblock.app/facilitator/slideshow')}">View your slideshow →</a></p>
        <p>— The MyBlock Team</p>
      `;
      return { subject, html };
    }

    default:
      return { subject: null, html: null };
  }
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendEmail, sendFacilitatorReminder };
