'use strict';

const { ValidationError } = require('../utils/errors');

/**
 * Returns middleware that validates req.body against a Joi schema.
 * On failure, passes a ValidationError to the next error handler.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const message = error.details.map((d) => d.message).join(', ');
      return next(new ValidationError(message));
    }
    next();
  };
}

module.exports = validate;
