'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AuthError } = require('../utils/errors');

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(new AuthError('Missing or malformed Authorization header', 'MISSING_TOKEN'));
    }

    const token = header.slice(7);

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AuthError('Token expired', 'TOKEN_EXPIRED'));
      }
      return next(new AuthError('Invalid token', 'INVALID_TOKEN'));
    }

    req.user = {
      sub: payload.sub,
      role: payload.role,
      school_id: payload.school_id,
      jti: payload.jti,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = auth;
