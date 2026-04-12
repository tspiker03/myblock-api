'use strict';

const { AuthError } = require('../utils/errors');

/**
 * Extracts school_id from the JWT payload (set by auth middleware) and
 * attaches it to req.schoolId for use in route handlers and queries.
 */
function schoolScope(req, res, next) {
  if (!req.user || !req.user.school_id) {
    return next(new AuthError('School scope missing from token', 'MISSING_SCHOOL_SCOPE'));
  }
  req.schoolId = req.user.school_id;
  next();
}

module.exports = schoolScope;
