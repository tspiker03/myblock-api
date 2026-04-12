'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const quickRepSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', default: null },
    name: { type: String, required: true },
    completedAt: { type: Date, required: true },
    weekKey: { type: String, required: true }, // e.g. "2026-W15"
  },
  { timestamps: false }
);

quickRepSchema.index({ userId: 1, weekKey: 1 });

module.exports = mongoose.model('QuickRep', quickRepSchema);
