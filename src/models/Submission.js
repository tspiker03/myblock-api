'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PILLARS, TIERS } = require('../utils/constants');

const STATUSES = [
  'active',
  'pending_confirmation',
  'pending_approval',
  'approved',
  'rejected',
  'abandoned',
];

const submissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    missionTemplateId: { type: Schema.Types.ObjectId, ref: 'MissionTemplate', required: true },

    tier: { type: Number, enum: TIERS, required: true },
    pillar: { type: String, enum: PILLARS, required: true },

    status: { type: String, enum: STATUSES, default: 'active' },

    evidenceUrls: { type: [String], default: [] },

    confirmedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      confirmedAt: { type: Date, default: null },
    },

    approvedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      approvedAt: { type: Date, default: null },
    },

    rejectedReason: { type: String, default: null },

    pointsAwarded: {
      teamPoints: { type: Number, default: null },
      pillarPoints: { type: Number, default: null },
      pillar: { type: String, enum: [...PILLARS, null], default: null },
    },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

submissionSchema.index({ userId: 1, status: 1 });
submissionSchema.index({ teamId: 1 });
submissionSchema.index({ schoolId: 1, classroomId: 1, status: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
