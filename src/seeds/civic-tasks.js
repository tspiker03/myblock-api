'use strict';

/**
 * Civic task catalog seed.
 * Run with: node src/seeds/civic-tasks.js
 * Or call seedCivicTasks() programmatically.
 */

const mongoose = require('mongoose');
const CivicTask = require('../models/CivicTask');

const CIVIC_TASKS = [
  {
    name: 'Clean up litter',
    description: 'Pick up litter in your neighborhood or school.',
    cosmeticPointReward: 1,
    respawnMinutes: 30,
    isActive: true,
  },
  {
    name: 'Water community garden',
    description: 'Water the plants in the community garden.',
    cosmeticPointReward: 1,
    respawnMinutes: 45,
    isActive: true,
  },
  {
    name: 'Help neighbor carry groceries',
    description: 'Offer to help a neighbor carry their groceries.',
    cosmeticPointReward: 2,
    respawnMinutes: 60,
    isActive: true,
  },
  {
    name: 'Welcome new resident',
    description: 'Introduce yourself and welcome someone new to the community.',
    cosmeticPointReward: 2,
    respawnMinutes: 120,
    isActive: true,
  },
  {
    name: 'Report graffiti',
    description: 'Report graffiti or vandalism to the appropriate authority.',
    cosmeticPointReward: 1,
    respawnMinutes: 30,
    isActive: true,
  },
  {
    name: 'Attend virtual town hall',
    description: 'Attend a virtual town hall meeting and participate.',
    cosmeticPointReward: 3,
    respawnMinutes: 1440, // daily
    isActive: true,
  },
];

async function seedCivicTasks() {
  for (const task of CIVIC_TASKS) {
    await CivicTask.findOneAndUpdate(
      { name: task.name },
      task,
      { upsert: true, new: true }
    );
  }
  console.log(`Seeded ${CIVIC_TASKS.length} civic tasks`);
}

if (require.main === module) {
  const config = require('../config/env');
  mongoose
    .connect(config.mongodbUri)
    .then(seedCivicTasks)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedCivicTasks, CIVIC_TASKS };
