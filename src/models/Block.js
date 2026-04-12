'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const plotSchema = new Schema(
  {
    buildingTemplateId: { type: Schema.Types.ObjectId, ref: 'BuildingTemplate', required: true },
    level: { type: Number, default: 1, min: 1, max: 3 },
    skinId: { type: String, default: null },
    placedAt: { type: Date, default: Date.now },
    upgradedAt: { type: Date, default: null },
  },
  { _id: false }
);

const blockSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    plots: {
      type: Map,
      of: plotSchema,
      default: {},
    },
    population: { type: Number, default: 0 },
    totalPointsSpent: { type: Number, default: 0 },
    expansionUnlocked: { type: Boolean, default: false },
    activeEventId: { type: Schema.Types.ObjectId, ref: 'BlockEvent', default: null },
  },
  { timestamps: true }
);

blockSchema.index({ userId: 1 }, { unique: true });
blockSchema.index({ schoolId: 1 });

module.exports = mongoose.model('Block', blockSchema);
