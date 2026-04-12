'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarSpriteKey: { type: String, default: 'default' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    joinCode: { type: String, required: true, unique: true, length: 6, uppercase: true },
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    members: {
      type: [memberSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 6,
        message: 'Team cannot have more than 6 members',
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teamSchema.index({ classroomId: 1 });
teamSchema.index({ schoolId: 1 });
teamSchema.index({ joinCode: 1 });

module.exports = mongoose.model('Team', teamSchema);
