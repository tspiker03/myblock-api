'use strict';

const express = require('express');
const router = express.Router();

const { Block, User, Team } = require('../models');
const auth = require('../middleware/auth');
const { NotFoundError } = require('../utils/errors');

// GET /neighborhoods/my-team — All 6 blocks for the current user's team
router.get('/my-team', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('teamId');
    if (!user || !user.teamId) throw new NotFoundError('User is not on a team');

    const members = await User.find({ teamId: user.teamId }).select('_id username displayName');
    const memberIds = members.map((m) => m._id);

    const blocks = await Block.find({ userId: { $in: memberIds } });

    // Map userId -> block for convenient lookup
    const blocksByUserId = {};
    for (const b of blocks) {
      blocksByUserId[String(b.userId)] = b;
    }

    const neighborhood = members.map((m) => ({
      user: { _id: m._id, username: m.username, displayName: m.displayName },
      block: blocksByUserId[String(m._id)] || null,
    }));

    res.json({ neighborhood });
  } catch (err) {
    next(err);
  }
});

// GET /neighborhoods/classroom — All team neighborhoods in the classroom (district view)
router.get('/classroom', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('classroomId');
    if (!user || !user.classroomId) throw new NotFoundError('User is not in a classroom');

    const teams = await Team.find({ classroomId: user.classroomId }).select('_id name');

    const district = await Promise.all(
      teams.map(async (team) => {
        const members = await User.find({ teamId: team._id }).select('_id username displayName');
        const memberIds = members.map((m) => m._id);
        const blocks = await Block.find({ userId: { $in: memberIds } });

        const blocksByUserId = {};
        for (const b of blocks) {
          blocksByUserId[String(b.userId)] = b;
        }

        const neighborhood = members.map((m) => ({
          user: { _id: m._id, username: m.username, displayName: m.displayName },
          block: blocksByUserId[String(m._id)] || null,
        }));

        return { team: { _id: team._id, name: team.name }, neighborhood };
      })
    );

    res.json({ district });
  } catch (err) {
    next(err);
  }
});

// GET /neighborhoods/:teamId — View a specific team's neighborhood
router.get('/:teamId', auth, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId).select('_id name');
    if (!team) throw new NotFoundError('Team not found');

    const members = await User.find({ teamId: team._id }).select('_id username displayName');
    const memberIds = members.map((m) => m._id);

    const blocks = await Block.find({ userId: { $in: memberIds } });

    const blocksByUserId = {};
    for (const b of blocks) {
      blocksByUserId[String(b.userId)] = b;
    }

    const neighborhood = members.map((m) => ({
      user: { _id: m._id, username: m.username, displayName: m.displayName },
      block: blocksByUserId[String(m._id)] || null,
    }));

    res.json({ team: { _id: team._id, name: team.name }, neighborhood });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
