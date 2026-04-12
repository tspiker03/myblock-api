'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const schoolSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    district: { type: String, default: null },
    address: { type: String, default: null },
    dpaActive: { type: Boolean, default: false },
    dpaDocumentUrl: { type: String, default: null },
    dpaActivatedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('School', schoolSchema);
