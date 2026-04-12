'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const civicTaskSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    cosmeticPointReward: { type: Number, required: true, min: 1 },
    respawnMinutes: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CivicTask', civicTaskSchema);
