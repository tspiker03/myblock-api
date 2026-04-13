'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const DELIVERY_METHODS = ['physical_pickup', 'gift_card', 'digital'];
const PRIZE_TIERS = ['monthly_team', 'quarterly_class', 'semester_individual'];
const PRIZE_STATUSES = ['pending_approval', 'approved', 'archived'];

const prizeSchema = new Schema(
  {
    sponsorId: { type: Schema.Types.ObjectId, ref: 'Sponsor', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, default: null },
    estimatedValue: { type: Number, min: 0 },
    deliveryMethod: { type: String, enum: DELIVERY_METHODS, required: true },
    tier: { type: String, enum: PRIZE_TIERS, required: true },
    status: { type: String, enum: PRIZE_STATUSES, default: 'pending_approval' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School' },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

prizeSchema.index({ sponsorId: 1 });
prizeSchema.index({ schoolId: 1, tier: 1, isActive: 1 });

module.exports = mongoose.model('Prize', prizeSchema);
