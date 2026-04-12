'use strict';

const { AppError } = require('../utils/errors');

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Not authenticated', 401, 'UNAUTHORIZED'));
  }
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
  }
  next();
};

module.exports = authorize;
