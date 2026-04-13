'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SPONSOR_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];

const sponsorSchema = new Schema(
  {
    businessName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    website: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    status: { type: String, enum: SPONSOR_STATUSES, default: 'pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    schoolIds: [{ type: Schema.Types.ObjectId, ref: 'School' }],
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

sponsorSchema.index({ contactEmail: 1 }, { unique: true });
sponsorSchema.index({ status: 1 });

module.exports = mongoose.model('Sponsor', sponsorSchema);
