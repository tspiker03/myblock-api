'use strict';

const express = require('express');
const Joi = require('joi');
const router = express.Router();

const blockService = require('../services/blockService');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const buildSchema = Joi.object({
  buildingTemplateId: Joi.string().hex().length(24).required(),
  col: Joi.number().integer().min(0).required(),
  row: Joi.number().integer().min(0).required(),
});

const upgradeSchema = Joi.object({
  col: Joi.number().integer().min(0).required(),
  row: Joi.number().integer().min(0).required(),
});

const undoSchema = Joi.object({
  col: Joi.number().integer().min(0).required(),
  row: Joi.number().integer().min(0).required(),
});

// GET /blocks/me — Get current user's block
router.get('/me', auth, async (req, res, next) => {
  try {
    const block = await blockService.getBlock(req.user.sub);
    res.json({ block });
  } catch (err) {
    next(err);
  }
});

// POST /blocks/me/build — Place a building
router.post('/me/build', auth, validate(buildSchema), async (req, res, next) => {
  try {
    const { buildingTemplateId, col, row } = req.body;
    const block = await blockService.placeBuilding(req.user.sub, buildingTemplateId, col, row);
    res.status(201).json({ block });
  } catch (err) {
    next(err);
  }
});

// POST /blocks/me/upgrade — Upgrade a building
router.post('/me/upgrade', auth, validate(upgradeSchema), async (req, res, next) => {
  try {
    const { col, row } = req.body;
    const block = await blockService.upgradeBuilding(req.user.sub, col, row);
    res.json({ block });
  } catch (err) {
    next(err);
  }
});

// POST /blocks/me/undo — Undo placement within 24h
router.post('/me/undo', auth, validate(undoSchema), async (req, res, next) => {
  try {
    const { col, row } = req.body;
    const block = await blockService.undoPlacement(req.user.sub, col, row);
    res.json({ block });
  } catch (err) {
    next(err);
  }
});

// GET /blocks/:userId — View another user's block
router.get('/:userId', auth, async (req, res, next) => {
  try {
    const block = await blockService.getBlock(req.params.userId);
    res.json({ block });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
