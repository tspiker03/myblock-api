'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const pillarCostSchema = new Schema(
  {
    agency: { type: Number, default: 0 },
    helping: { type: Number, default: 0 },
    character: { type: Number, default: 0 },
    curiosity: { type: Number, default: 0 },
    learning: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
  },
  { _id: false }
);

const buildingTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['starter', 'decorative', 'basic', 'medium', 'landmark', 'premium'],
      required: true,
    },
    description: { type: String, default: '' },
    loreText: { type: String, default: '' },
    tileSize: { type: Number, enum: [1, 2, 4], default: 1 },
    costs: {
      level1: { type: pillarCostSchema, default: () => ({}) },
      level2: { type: pillarCostSchema, default: () => ({}) },
      level3: { type: pillarCostSchema, default: () => ({}) },
    },
    population: {
      level1: { type: Number, default: 0 },
      level2: { type: Number, default: 0 },
      level3: { type: Number, default: 0 },
    },
    maxLevel: { type: Number, default: 3, min: 1, max: 3 },
    spriteKeys: {
      level1: { type: String, default: '' },
      level2: { type: String, default: '' },
      level3: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

buildingTemplateSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model('BuildingTemplate', buildingTemplateSchema);
