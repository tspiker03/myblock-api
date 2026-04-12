'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const civicTaskCompletionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    civicTaskId: { type: Schema.Types.ObjectId, ref: 'CivicTask', required: true },
    targetBlockUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date, required: true },
    nextAvailableAt: { type: Date, required: true },
  },
  { timestamps: false }
);

// For respawn timer lookups
civicTaskCompletionSchema.index({ userId: 1, civicTaskId: 1, targetBlockUserId: 1 });

module.exports = mongoose.model('CivicTaskCompletion', civicTaskCompletionSchema);
