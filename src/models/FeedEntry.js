'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const feedEntrySchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', default: null },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    type: {
      type: String,
      required: true,
      enum: [
        'mission_complete',
        'quick_rep',
        'gift',
        'building_placed',
        'building_upgraded',
        'event_resolved',
        'leaderboard_shift',
        'season_milestone',
        'announcement',
      ],
    },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorUsername: { type: String, required: true },
    actorDisplayName: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    visibility: { type: String, enum: ['team', 'classroom', 'school'], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// TTL index: entries expire after 30 days
feedEntrySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Query indexes
feedEntrySchema.index({ schoolId: 1, classroomId: 1, createdAt: -1 });
feedEntrySchema.index({ teamId: 1, createdAt: -1 });

module.exports = mongoose.model('FeedEntry', feedEntrySchema);
