'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const reportService = require('../services/reportService');
const { Classroom, Season } = require('../models');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { NotFoundError } = require('../utils/errors');

const dateRangeSchema = Joi.object({
  start: Joi.string().isoDate().optional(),
  end: Joi.string().isoDate().optional(),
  format: Joi.string().valid('csv', 'json').optional(),
});

async function resolveClassroom(req) {
  let classroom;
  if (req.query.classroomId) {
    classroom = await Classroom.findOne({ _id: req.query.classroomId, facilitatorId: req.user.sub });
  } else {
    classroom = await Classroom.findOne({ facilitatorId: req.user.sub });
  }
  if (!classroom) throw new NotFoundError('No classroom found for this facilitator');
  return classroom;
}

async function resolveDefaultDateRange(classroom) {
  if (!classroom.seasonId) {
    // Default to last 30 days if no season
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  }
  const season = await Season.findById(classroom.seasonId).select('startDate endDate');
  if (!season) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  }
  return { start: season.startDate, end: season.endDate };
}

// GET /reports/pillars — Pillar distribution for facilitator's classroom
router.get('/pillars', auth, authorize('facilitator', 'school_admin', 'admin'), async (req, res, next) => {
  try {
    const classroom = await resolveClassroom(req);

    let dateRange;
    if (req.query.start || req.query.end) {
      if (req.query.start && isNaN(Date.parse(req.query.start))) {
        return next(new (require('../utils/errors').ValidationError)('Invalid start date'));
      }
      if (req.query.end && isNaN(Date.parse(req.query.end))) {
        return next(new (require('../utils/errors').ValidationError)('Invalid end date'));
      }
      dateRange = {
        start: req.query.start || undefined,
        end: req.query.end || undefined,
      };
    } else {
      dateRange = await resolveDefaultDateRange(classroom);
    }

    const data = await reportService.getPillarDistribution(classroom._id, dateRange);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /reports/export — Export classroom data as CSV or JSON
router.get('/export', auth, authorize('facilitator', 'school_admin', 'admin'), async (req, res, next) => {
  try {
    const classroom = await resolveClassroom(req);

    const format = req.query.format || 'json';

    let dateRange;
    if (req.query.start || req.query.end) {
      dateRange = {
        start: req.query.start || undefined,
        end: req.query.end || undefined,
      };
    } else {
      dateRange = await resolveDefaultDateRange(classroom);
    }

    const result = await reportService.getExportData(classroom._id, dateRange, format);

    if (format === 'csv') {
      const filename = `myblock-report-${classroom.name.replace(/[^a-zA-Z0-9_-]/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(result.csv);
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /reports/slideshow — Weekly showcase slide data
router.get('/slideshow', auth, authorize('facilitator', 'school_admin', 'admin'), async (req, res, next) => {
  try {
    const classroom = await resolveClassroom(req);
    const slides = await reportService.generateSlideshowData(classroom._id);
    res.json({ slides });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
