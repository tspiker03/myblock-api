'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PILLARS, ROLES } = require('../utils/constants');

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    displayName: { type: String, required: true, trim: true },
    email: {
      type: String,
      sparse: true,
      unique: true,
      lowercase: true,
      trim: true,
      default: null,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'student' },

    schoolId: { type: Schema.Types.ObjectId, ref: 'School', default: null },
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', default: null },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    gradeLevel: { type: Number, min: 1, max: 12, default: null },

    avatar: {
      spriteKey: { type: String, default: 'default' },
      skinIds: { type: [String], default: [] },
      equippedSkinId: { type: String, default: null },
    },

    balances: {
      agency: { type: Number, default: 0 },
      helping: { type: Number, default: 0 },
      character: { type: Number, default: 0 },
      curiosity: { type: Number, default: 0 },
      learning: { type: Number, default: 0 },
      problemSolving: { type: Number, default: 0 },
      teamPoints: { type: Number, default: 0 },
      cosmeticPoints: { type: Number, default: 0 },
    },

    gifting: {
      receivedThisWeek: { type: Number, default: 0 },
      weekKey: { type: String, default: null }, // e.g. "2025-W15"
    },

    activeMissionId: { type: Schema.Types.ObjectId, ref: 'Submission', default: null },

    fcmTokens: { type: [String], default: [] },

    notificationPrefs: {
      mondayLaunch: {
        push: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      thursdayQueue: {
        push: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
      fridaySlideshow: {
        push: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
    },

    // COPPA fields
    dateOfBirth: { type: Date, default: null },
    parentEmail: { type: String, default: null },
    parentConsentAt: { type: Date, default: null },
    parentConsentToken: { type: String, default: null, select: false },
    coppaExempt: { type: Boolean, default: false },

    enhancedReview: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },
    lastActiveAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ username: 1 });
userSchema.index({ schoolId: 1, classroomId: 1 });
userSchema.index({ teamId: 1 });
userSchema.index({ email: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
