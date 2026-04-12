'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const leaderboardEntrySchema = new Schema(
  {
    entityId: { type: Schema.Types.ObjectId, required: true },
    entityName: { type: String, required: true },
    totalTeamPoints: { type: Number, default: 0 },
    rank: { type: Number, required: true },
    previousRank: { type: Number, default: null },
    movement: { type: Number, default: 0 },
  },
  { _id: false }
);

const leaderboardSchema = new Schema(
  {
    scope: { type: String, enum: ['team', 'classroom', 'school'], required: true },
    scopeId: { type: Schema.Types.ObjectId, required: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', default: null },
    entries: { type: [leaderboardEntrySchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

leaderboardSchema.index({ scope: 1, scopeId: 1 }, { unique: true });

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
