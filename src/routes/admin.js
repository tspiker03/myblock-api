'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const sponsorService = require('../services/sponsorService');
const { NotFoundError } = require('../utils/errors');

// All admin routes require auth + admin role
router.use(auth, authorize('admin'));

// ---------------------------------------------------------------------------
// Sponsor management
// ---------------------------------------------------------------------------

// GET /admin/sponsors?status=pending
router.get('/sponsors', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status || undefined,
      page: req.query.page,
      limit: req.query.limit,
    };
    const result = await sponsorService.listSponsors(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/sponsors/:id/approve
router.patch('/sponsors/:id/approve', async (req, res, next) => {
  try {
    const sponsor = await sponsorService.approveSponsor(req.params.id, req.user.sub);
    res.json({ sponsor });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/sponsors/:id/reject
router.patch('/sponsors/:id/reject', async (req, res, next) => {
  try {
    const sponsor = await sponsorService.rejectSponsor(req.params.id, req.user.sub);
    res.json({ sponsor });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Prize management
// ---------------------------------------------------------------------------

// GET /admin/prizes/pending
router.get('/prizes/pending', async (req, res, next) => {
  try {
    const prizes = await sponsorService.listPendingPrizes();
    res.json({ prizes });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/prizes/:id/approve
router.patch('/prizes/:id/approve', async (req, res, next) => {
  try {
    const prize = await sponsorService.approvePrize(req.params.id, req.user.sub);
    res.json({ prize });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Threshold draws
// ---------------------------------------------------------------------------

// POST /admin/draws/:schoolId/:seasonId/conduct
router.post('/draws/:schoolId/:seasonId/conduct', async (req, res, next) => {
  try {
    const { schoolId, seasonId } = req.params;
    const draw = await sponsorService.conductThresholdDraw(schoolId, seasonId);
    res.status(201).json({ draw });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
