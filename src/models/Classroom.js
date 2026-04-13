'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const classroomSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    gradeLevel: { type: Number, min: 1, max: 12, required: true },
    facilitatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    seasonId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    mode: { type: String, enum: ['school', 'club'], default: 'school' },
    modeConfig: {
      teamSizeMin: { type: Number, default: 5 },
      teamSizeMax: { type: Number, default: 7 },
      gradeHandicap: { type: Boolean, default: true },
      customSeasonDates: { type: Boolean, default: false },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

classroomSchema.index({ schoolId: 1 });
classroomSchema.index({ facilitatorId: 1 });

module.exports = mongoose.model('Classroom', classroomSchema);
