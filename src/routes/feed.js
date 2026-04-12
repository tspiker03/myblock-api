'use strict';

const express = require('express');
const router = express.Router();

const feedService = require('../services/feedService');
const auth = require('../middleware/auth');

// GET /feed — Get feed entries for current user
// Query: scope (team|classroom|school), since (ISO date), limit (default 50)
router.get('/', auth, async (req, res, next) => {
  try {
    const { scope = 'school', since, limit } = req.query;
    const entries = await feedService.getFeed(req.user.sub, scope, since, parseInt(limit, 10));
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
