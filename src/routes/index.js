'use strict';

const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/teams', require('./teams'));
router.use('/missions', require('./missions'));
router.use('/submissions', require('./submissions'));
router.use('/blocks', require('./blocks'));
router.use('/buildings', require('./buildings'));
router.use('/economy', require('./economy'));
router.use('/events', require('./events'));

module.exports = router;
