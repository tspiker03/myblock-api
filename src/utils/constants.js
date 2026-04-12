'use strict';

module.exports = {
  POINT_VALUES: {
    TIER_1: { teamPoints: 1, pillarPoints: 10 },
    TIER_2: { teamPoints: 5, pillarPoints: 50 },
    TIER_3: { teamPoints: 15, pillarPoints: 150 },
    QUICK_REP: { teamPoints: 0.5, cosmeticPoints: 3 },
  },
  QUICK_REP_WEEKLY_CAP: 2,
  GIFT_RECEIVE_WEEKLY_CAP: 30,
  PILLARS: ['agency', 'helping', 'character', 'curiosity', 'learning', 'problemSolving'],
  TIERS: [1, 2, 3],
  ROLES: ['student', 'facilitator', 'school_admin', 'admin'],
  SAFETY_TAGS: [
    'solo_safe',
    'buddy_required',
    'adult_supervised',
    'public_space_only',
    'adult_interaction',
  ],
};
