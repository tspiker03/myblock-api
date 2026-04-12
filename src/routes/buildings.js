'use strict';

const express = require('express');
const router = express.Router();

const { BuildingTemplate, User } = require('../models');
const { NotFoundError } = require('../utils/errors');
const auth = require('../middleware/auth');
const { PILLARS } = require('../utils/constants');

// GET /buildings — Catalog; optional ?category=&affordable=true
router.get('/', auth, async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.category) filter.category = req.query.category;

    const templates = await BuildingTemplate.find(filter).sort({ category: 1, name: 1 });

    if (req.query.affordable === 'true') {
      const user = await User.findById(req.user.sub).select('balances');
      const balances = user ? user.balances : {};

      const affordable = templates.filter((t) => {
        const costs = t.costs.level1;
        return PILLARS.every(
          (p) => !costs[p] || costs[p] === 0 || (balances[p] || 0) >= costs[p]
        );
      });
      return res.json({ buildings: affordable });
    }

    res.json({ buildings: templates });
  } catch (err) {
    next(err);
  }
});

// GET /buildings/:id — Building detail
router.get('/:id', auth, async (req, res, next) => {
  try {
    const template = await BuildingTemplate.findById(req.params.id);
    if (!template) throw new NotFoundError('Building template not found');
    res.json({ building: template });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
