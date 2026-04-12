'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const seasonSchema = new Schema(
  {
    name: { type: String, required: true },
    theme: { type: String, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  },
  { timestamps: true }
);

seasonSchema.index({ schoolId: 1, isActive: 1 });

module.exports = mongoose.model('Season', seasonSchema);
