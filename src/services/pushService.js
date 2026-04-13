'use strict';

const config = require('../config/env');
const { User } = require('../models');

let _messaging = null;

function getMessaging() {
  if (_messaging) return _messaging;

  if (!config.fcmProjectId || !config.fcmClientEmail || !config.fcmPrivateKey) {
    console.warn('[pushService] Firebase not configured — push notifications disabled');
    return null;
  }

  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.fcmProjectId,
          clientEmail: config.fcmClientEmail,
          privateKey: config.fcmPrivateKey,
        }),
      });
    }
    _messaging = admin.messaging();
    return _messaging;
  } catch (err) {
    console.error('[pushService] Firebase init error:', err.message);
    return null;
  }
}

/**
 * Remove a set of invalid FCM tokens from a user's fcmTokens array.
 */
async function pruneTokens(userId, badTokens) {
  if (!badTokens.length) return;
  await User.updateOne(
    { _id: userId },
    { $pull: { fcmTokens: { $in: badTokens } } }
  );
}

/**
 * Send a push notification to a single user.
 * Fire-and-forget — never throws.
 *
 * @param {string} userId
 * @param {string} title
 * @param {string} body
 * @param {Object} data  - key/value pairs (all strings). Must NOT include student PII.
 */
async function sendPush(userId, title, body, data = {}) {
  const messaging = getMessaging();
  if (!messaging) return;

  try {
    const user = await User.findById(userId).select('fcmTokens').lean();
    if (!user || !user.fcmTokens.length) return;

    const badTokens = [];

    await Promise.all(
      user.fcmTokens.map(async (token) => {
        try {
          await messaging.send({
            token,
            notification: { title, body },
            data: _stringifyData(data),
          });
        } catch (err) {
          if (_isInvalidTokenError(err)) {
            badTokens.push(token);
          } else {
            console.error('[pushService] send error for token:', err.message);
          }
        }
      })
    );

    await pruneTokens(userId, badTokens);
  } catch (err) {
    console.error('[pushService] sendPush error:', err.message);
  }
}

/**
 * Send a push notification to many users.
 * Fire-and-forget — never throws.
 *
 * @param {string[]} userIds
 * @param {string} title
 * @param {string} body
 * @param {Object} data
 */
async function sendPushToMany(userIds, title, body, data = {}) {
  const messaging = getMessaging();
  if (!messaging || !userIds.length) return;

  try {
    const users = await User.find(
      { _id: { $in: userIds }, fcmTokens: { $not: { $size: 0 } } }
    ).select('_id fcmTokens').lean();

    // Build token → userId map for cleanup
    const tokenToUser = {};
    const allTokens = [];
    for (const user of users) {
      for (const token of user.fcmTokens) {
        tokenToUser[token] = user._id;
        allTokens.push(token);
      }
    }

    if (!allTokens.length) return;

    const response = await messaging.sendEachForMulticast({
      tokens: allTokens,
      notification: { title, body },
      data: _stringifyData(data),
    });

    // Collect bad tokens grouped by userId for pruning
    const badByUser = {};
    response.responses.forEach((r, idx) => {
      if (!r.success && _isInvalidTokenError(r.error)) {
        const token = allTokens[idx];
        const uid = String(tokenToUser[token]);
        if (!badByUser[uid]) badByUser[uid] = [];
        badByUser[uid].push(token);
      } else if (!r.success) {
        console.error('[pushService] multicast error:', r.error && r.error.message);
      }
    });

    await Promise.all(
      Object.entries(badByUser).map(([uid, tokens]) => pruneTokens(uid, tokens))
    );
  } catch (err) {
    console.error('[pushService] sendPushToMany error:', err.message);
  }
}

function _isInvalidTokenError(err) {
  if (!err) return false;
  const code = err.code || (err.errorInfo && err.errorInfo.code) || '';
  return code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token';
}

function _stringifyData(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = String(v);
  }
  return out;
}

module.exports = { sendPush, sendPushToMany };
