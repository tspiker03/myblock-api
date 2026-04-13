'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const DRAW_STATUSES = ['open', 'drawn', 'delivered'];

const thresholdDrawSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true },
    prizeId: { type: Schema.Types.ObjectId, ref: 'Prize', default: null },
    threshold: {
      missionsPerWeek: { type: Number, min: 1 },
      weeksRequired: { type: Number, min: 1 },
    },
    qualifiedStudentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    winnerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    drawnAt: { type: Date, default: null },
    drawLog: { type: String, default: null },
    status: { type: String, enum: DRAW_STATUSES, default: 'open' },
  },
  { timestamps: true }
);

thresholdDrawSchema.index({ schoolId: 1, seasonId: 1 }, { unique: true });

module.exports = mongoose.model('ThresholdDraw', thresholdDrawSchema);
