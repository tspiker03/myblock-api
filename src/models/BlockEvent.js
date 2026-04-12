'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const blockEventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['safety', 'health', 'education', 'economic', 'community'],
      required: true,
    },
    effect: { type: String, enum: ['positive', 'negative', 'neutral'], required: true },
    resolutionBuilding: {
      buildingTemplateId: { type: Schema.Types.ObjectId, ref: 'BuildingTemplate', default: null },
      minLevel: { type: Number, default: 1, min: 1, max: 3 },
    },
    resolutionMission: {
      missionTemplateId: { type: Schema.Types.ObjectId, ref: 'MissionTemplate', default: null },
    },
    populationImpact: { type: Number, default: 0 },
    duration: { type: Number, default: 7 }, // days
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

blockEventSchema.index({ isActive: 1, category: 1 });

module.exports = mongoose.model('BlockEvent', blockEventSchema);
