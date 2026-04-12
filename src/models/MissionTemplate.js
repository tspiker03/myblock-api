'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PILLARS, TIERS, SAFETY_TAGS } = require('../utils/constants');

const missionTemplateSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    tier: { type: Number, enum: TIERS, required: true },
    pillar: { type: String, enum: PILLARS, required: true },
    gradeRange: {
      min: { type: Number, min: 1, max: 12, required: true },
      max: { type: Number, min: 1, max: 12, required: true },
    },
    safetyTags: {
      type: [String],
      enum: SAFETY_TAGS,
      default: [],
    },
    pointValues: {
      teamPoints: { type: Number, required: true },
      pillarPoints: { type: Number, required: true },
    },
    isActive: { type: Boolean, default: true },
    seasonId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

missionTemplateSchema.index({ pillar: 1, tier: 1 });
missionTemplateSchema.index({ isActive: 1 });

module.exports = mongoose.model('MissionTemplate', missionTemplateSchema);
