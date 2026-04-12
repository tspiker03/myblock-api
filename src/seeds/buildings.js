'use strict';

/**
 * Full building catalog seed.
 * Run with: node src/seeds/buildings.js
 * Or import seedBuildings() from another script.
 */

const mongoose = require('mongoose');
const BuildingTemplate = require('../models/BuildingTemplate');

const BUILDINGS = [
  // ── STARTERS (5-15 pts total) ─────────────────────────────────────────────
  {
    name: 'Fence',
    category: 'starter',
    description: 'A simple fence to mark your space.',
    loreText: 'Every block starts with boundaries.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 3, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 0, character: 6, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 0, character: 10, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'fence_l1', level2: 'fence_l2', level3: 'fence_l3' },
  },
  {
    name: 'Bench',
    category: 'starter',
    description: 'A public bench for neighbors to rest.',
    loreText: 'Rest here awhile.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 5, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 8, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 12, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 1, level2: 2, level3: 3 },
    spriteKeys: { level1: 'bench_l1', level2: 'bench_l2', level3: 'bench_l3' },
  },
  {
    name: 'Tree',
    category: 'starter',
    description: 'A young tree that provides shade and beauty.',
    loreText: 'Planted by the community, grown for everyone.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 5, character: 0, curiosity: 5, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 8, character: 0, curiosity: 8, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 12, character: 0, curiosity: 12, learning: 0, problemSolving: 0 },
    },
    population: { level1: 1, level2: 2, level3: 4 },
    spriteKeys: { level1: 'tree_l1', level2: 'tree_l2', level3: 'tree_l3' },
  },
  {
    name: 'Streetlight',
    category: 'starter',
    description: 'Lights the block at night.',
    loreText: 'Darkness fades where neighbors care.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 5, problemSolving: 5 },
      level2: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 8, problemSolving: 8 },
      level3: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 12, problemSolving: 12 },
    },
    population: { level1: 1, level2: 2, level3: 3 },
    spriteKeys: { level1: 'streetlight_l1', level2: 'streetlight_l2', level3: 'streetlight_l3' },
  },
  {
    name: 'Garden Patch',
    category: 'starter',
    description: 'A small patch of vegetables and flowers.',
    loreText: 'Grown with patience and care.',
    tileSize: 1,
    costs: {
      level1: { agency: 5, helping: 5, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 8, helping: 8, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 12, helping: 12, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 1, level2: 3, level3: 5 },
    spriteKeys: { level1: 'garden_patch_l1', level2: 'garden_patch_l2', level3: 'garden_patch_l3' },
  },
  {
    name: 'Mailbox',
    category: 'starter',
    description: 'A neighborhood mailbox.',
    loreText: 'Messages connect us.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 5, character: 5, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 8, character: 8, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 12, character: 12, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 1, level2: 2, level3: 3 },
    spriteKeys: { level1: 'mailbox_l1', level2: 'mailbox_l2', level3: 'mailbox_l3' },
  },

  // ── DECORATIVES (3-5 pts total) ───────────────────────────────────────────
  {
    name: 'Flower Pot',
    category: 'decorative',
    description: 'Colorful pots brighten any stoop.',
    loreText: 'Small beauty, big difference.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 3, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 5, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 8, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 1, level3: 1 },
    spriteKeys: { level1: 'flower_pot_l1', level2: 'flower_pot_l2', level3: 'flower_pot_l3' },
  },
  {
    name: 'Fire Hydrant',
    category: 'decorative',
    description: 'Keeps the block safe from fires.',
    loreText: 'Safety is a community value.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 3, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 0, character: 5, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 0, character: 8, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'hydrant_l1', level2: 'hydrant_l2', level3: 'hydrant_l3' },
  },
  {
    name: 'Flag Pole',
    category: 'decorative',
    description: 'A flag that represents your block.',
    loreText: 'Raise your colors with pride.',
    tileSize: 1,
    costs: {
      level1: { agency: 3, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 5, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 8, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 1, level3: 1 },
    spriteKeys: { level1: 'flag_pole_l1', level2: 'flag_pole_l2', level3: 'flag_pole_l3' },
  },
  {
    name: 'Bird Feeder',
    category: 'decorative',
    description: 'Attracts birds and creates a peaceful atmosphere.',
    loreText: 'Nature finds a home here.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 0, curiosity: 3, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 0, character: 0, curiosity: 5, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 0, character: 0, curiosity: 8, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'bird_feeder_l1', level2: 'bird_feeder_l2', level3: 'bird_feeder_l3' },
  },
  {
    name: 'Stepping Stones',
    category: 'decorative',
    description: 'A charming path through the yard.',
    loreText: 'Every path starts with one step.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 3, problemSolving: 0 },
      level2: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 5, problemSolving: 0 },
      level3: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 8, problemSolving: 0 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'stepping_stones_l1', level2: 'stepping_stones_l2', level3: 'stepping_stones_l3' },
  },
  {
    name: 'Picket Gate',
    category: 'decorative',
    description: 'A welcoming gate at the front of a yard.',
    loreText: 'Always open to good neighbors.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 3, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 5, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 8, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'picket_gate_l1', level2: 'picket_gate_l2', level3: 'picket_gate_l3' },
  },
  {
    name: 'Yard Sign',
    category: 'decorative',
    description: 'Express your block values.',
    loreText: 'Words matter in the neighborhood.',
    tileSize: 1,
    costs: {
      level1: { agency: 3, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 5, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 8, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'yard_sign_l1', level2: 'yard_sign_l2', level3: 'yard_sign_l3' },
  },
  {
    name: 'Rock Garden',
    category: 'decorative',
    description: 'A zen garden of carefully arranged rocks.',
    loreText: 'Order and calm in the outdoors.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 3, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 0, character: 5, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 0, character: 8, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 1, level3: 1 },
    spriteKeys: { level1: 'rock_garden_l1', level2: 'rock_garden_l2', level3: 'rock_garden_l3' },
  },
  {
    name: 'Wind Chime',
    category: 'decorative',
    description: 'A gentle sound that soothes the neighborhood.',
    loreText: 'Harmony, carried on the wind.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 0, curiosity: 3, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 0, character: 0, curiosity: 5, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 0, character: 0, curiosity: 8, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'wind_chime_l1', level2: 'wind_chime_l2', level3: 'wind_chime_l3' },
  },
  {
    name: 'Bike Rack',
    category: 'decorative',
    description: 'Encourages sustainable transport.',
    loreText: 'Ride green, ride together.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 3 },
      level2: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 5 },
      level3: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 0, problemSolving: 8 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'bike_rack_l1', level2: 'bike_rack_l2', level3: 'bike_rack_l3' },
  },
  {
    name: 'Welcome Mat',
    category: 'decorative',
    description: 'Every home needs a welcome mat.',
    loreText: 'Hospitality starts at the door.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 3, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 0, helping: 5, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 0, helping: 8, character: 0, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'welcome_mat_l1', level2: 'welcome_mat_l2', level3: 'welcome_mat_l3' },
  },
  {
    name: 'Birdhouse',
    category: 'decorative',
    description: 'Provides shelter for local birds.',
    loreText: 'Share your space with nature.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 3, problemSolving: 0 },
      level2: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 5, problemSolving: 0 },
      level3: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 8, problemSolving: 0 },
    },
    population: { level1: 0, level2: 0, level3: 1 },
    spriteKeys: { level1: 'birdhouse_l1', level2: 'birdhouse_l2', level3: 'birdhouse_l3' },
  },

  // ── BASIC (40-100 pts total) ──────────────────────────────────────────────
  {
    name: 'Small House',
    category: 'basic',
    description: 'A cozy home for a family on the block.',
    loreText: 'A block is only as strong as its homes.',
    tileSize: 1,
    costs: {
      level1: { agency: 15, helping: 15, character: 10, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 25, helping: 25, character: 20, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 35, helping: 35, character: 30, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 4, level2: 8, level3: 12 },
    spriteKeys: { level1: 'small_house_l1', level2: 'small_house_l2', level3: 'small_house_l3' },
  },
  {
    name: 'Corner Store',
    category: 'basic',
    description: 'A local shop serving the neighborhood.',
    loreText: 'Commerce builds community.',
    tileSize: 1,
    costs: {
      level1: { agency: 20, helping: 10, character: 0, curiosity: 10, learning: 0, problemSolving: 10 },
      level2: { agency: 30, helping: 20, character: 0, curiosity: 20, learning: 0, problemSolving: 20 },
      level3: { agency: 40, helping: 30, character: 0, curiosity: 30, learning: 0, problemSolving: 30 },
    },
    population: { level1: 3, level2: 6, level3: 10 },
    spriteKeys: { level1: 'corner_store_l1', level2: 'corner_store_l2', level3: 'corner_store_l3' },
  },
  {
    name: 'Basketball Court',
    category: 'basic',
    description: 'A court for pickup games and community bonding.',
    loreText: 'Teamwork on the court, teamwork in life.',
    tileSize: 2,
    costs: {
      level1: { agency: 10, helping: 20, character: 10, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 20, helping: 30, character: 20, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 30, helping: 40, character: 30, curiosity: 0, learning: 0, problemSolving: 0 },
    },
    population: { level1: 4, level2: 8, level3: 14 },
    spriteKeys: { level1: 'bball_court_l1', level2: 'bball_court_l2', level3: 'bball_court_l3' },
  },
  {
    name: 'Bus Stop',
    category: 'basic',
    description: 'Connects the block to the rest of the city.',
    loreText: 'Moving people, building connections.',
    tileSize: 1,
    costs: {
      level1: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 20, problemSolving: 20 },
      level2: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 35, problemSolving: 35 },
      level3: { agency: 0, helping: 0, character: 0, curiosity: 0, learning: 50, problemSolving: 50 },
    },
    population: { level1: 2, level2: 5, level3: 8 },
    spriteKeys: { level1: 'bus_stop_l1', level2: 'bus_stop_l2', level3: 'bus_stop_l3' },
  },
  {
    name: 'Community Garden',
    category: 'basic',
    description: 'A shared garden where residents grow food together.',
    loreText: 'Roots run deep when we grow together.',
    tileSize: 2,
    costs: {
      level1: { agency: 0, helping: 15, character: 0, curiosity: 10, learning: 5, problemSolving: 0 },
      level2: { agency: 0, helping: 25, character: 0, curiosity: 20, learning: 15, problemSolving: 0 },
      level3: { agency: 0, helping: 40, character: 0, curiosity: 30, learning: 25, problemSolving: 10 },
    },
    population: { level1: 2, level2: 5, level3: 8 },
    spriteKeys: { level1: 'community_garden_l1', level2: 'community_garden_l2', level3: 'community_garden_l3' },
  },

  // ── MEDIUM (75-150 pts total) ─────────────────────────────────────────────
  {
    name: 'School',
    category: 'medium',
    description: 'Education for the young people of the block.',
    loreText: 'Learning shapes the future.',
    tileSize: 2,
    costs: {
      level1: { agency: 10, helping: 10, character: 10, curiosity: 20, learning: 30, problemSolving: 10 },
      level2: { agency: 20, helping: 20, character: 20, curiosity: 35, learning: 50, problemSolving: 20 },
      level3: { agency: 30, helping: 30, character: 30, curiosity: 50, learning: 70, problemSolving: 30 },
    },
    population: { level1: 8, level2: 16, level3: 25 },
    spriteKeys: { level1: 'school_l1', level2: 'school_l2', level3: 'school_l3' },
  },
  {
    name: 'Playground',
    category: 'medium',
    description: 'Where children play and friendships form.',
    loreText: 'Joy is the foundation of a healthy block.',
    tileSize: 2,
    costs: {
      level1: { agency: 10, helping: 25, character: 10, curiosity: 10, learning: 10, problemSolving: 10 },
      level2: { agency: 20, helping: 40, character: 20, curiosity: 20, learning: 20, problemSolving: 20 },
      level3: { agency: 30, helping: 55, character: 30, curiosity: 30, learning: 30, problemSolving: 30 },
    },
    population: { level1: 6, level2: 12, level3: 20 },
    spriteKeys: { level1: 'playground_l1', level2: 'playground_l2', level3: 'playground_l3' },
  },
  {
    name: 'Restaurant',
    category: 'medium',
    description: 'Good food brings people together.',
    loreText: 'A table is a place of belonging.',
    tileSize: 2,
    costs: {
      level1: { agency: 20, helping: 20, character: 10, curiosity: 10, learning: 10, problemSolving: 10 },
      level2: { agency: 35, helping: 35, character: 20, curiosity: 20, learning: 20, problemSolving: 20 },
      level3: { agency: 50, helping: 50, character: 30, curiosity: 30, learning: 30, problemSolving: 30 },
    },
    population: { level1: 5, level2: 10, level3: 18 },
    spriteKeys: { level1: 'restaurant_l1', level2: 'restaurant_l2', level3: 'restaurant_l3' },
  },
  {
    name: 'Clinic',
    category: 'medium',
    description: 'Healthcare for the whole neighborhood.',
    loreText: 'A healthy block is a happy block.',
    tileSize: 2,
    costs: {
      level1: { agency: 10, helping: 30, character: 10, curiosity: 10, learning: 15, problemSolving: 0 },
      level2: { agency: 20, helping: 50, character: 20, curiosity: 20, learning: 25, problemSolving: 0 },
      level3: { agency: 30, helping: 70, character: 30, curiosity: 30, learning: 35, problemSolving: 0 },
    },
    population: { level1: 7, level2: 14, level3: 22 },
    spriteKeys: { level1: 'clinic_l1', level2: 'clinic_l2', level3: 'clinic_l3' },
  },
  {
    name: 'Workshop',
    category: 'medium',
    description: 'A place to build, repair, and create.',
    loreText: 'Skills built here serve the whole community.',
    tileSize: 2,
    costs: {
      level1: { agency: 20, helping: 10, character: 10, curiosity: 10, learning: 10, problemSolving: 20 },
      level2: { agency: 35, helping: 20, character: 20, curiosity: 20, learning: 20, problemSolving: 35 },
      level3: { agency: 50, helping: 30, character: 30, curiosity: 30, learning: 30, problemSolving: 50 },
    },
    population: { level1: 6, level2: 12, level3: 20 },
    spriteKeys: { level1: 'workshop_l1', level2: 'workshop_l2', level3: 'workshop_l3' },
  },

  // ── LANDMARKS (45-250 pts total) ──────────────────────────────────────────
  {
    name: 'Library',
    category: 'landmark',
    description: 'Knowledge shared is power multiplied.',
    loreText: 'Every book opens a door.',
    tileSize: 2,
    costs: {
      level1: { agency: 10, helping: 5, character: 5, curiosity: 15, learning: 10, problemSolving: 0 },
      level2: { agency: 20, helping: 10, character: 10, curiosity: 30, learning: 25, problemSolving: 0 },
      level3: { agency: 40, helping: 20, character: 20, curiosity: 60, learning: 50, problemSolving: 10 },
    },
    population: { level1: 5, level2: 12, level3: 20 },
    spriteKeys: { level1: 'library_l1', level2: 'library_l2', level3: 'library_l3' },
  },
  {
    name: 'Fire Station',
    category: 'landmark',
    description: 'Protects every resident on the block.',
    loreText: 'Courage is a community asset.',
    tileSize: 2,
    costs: {
      level1: { agency: 15, helping: 15, character: 15, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 30, helping: 30, character: 30, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 60, helping: 60, character: 60, curiosity: 0, learning: 0, problemSolving: 30 },
    },
    population: { level1: 6, level2: 14, level3: 22 },
    spriteKeys: { level1: 'fire_station_l1', level2: 'fire_station_l2', level3: 'fire_station_l3' },
  },
  {
    name: 'Community Center',
    category: 'landmark',
    description: 'The heart of the neighborhood.',
    loreText: 'Where people gather, community grows.',
    tileSize: 4,
    costs: {
      level1: { agency: 15, helping: 15, character: 5, curiosity: 5, learning: 5, problemSolving: 0 },
      level2: { agency: 30, helping: 30, character: 15, curiosity: 15, learning: 15, problemSolving: 0 },
      level3: { agency: 60, helping: 60, character: 30, curiosity: 30, learning: 30, problemSolving: 30 },
    },
    population: { level1: 8, level2: 18, level3: 30 },
    spriteKeys: { level1: 'community_center_l1', level2: 'community_center_l2', level3: 'community_center_l3' },
  },
  {
    name: 'Park',
    category: 'landmark',
    description: 'Green space for everyone to enjoy.',
    loreText: 'Nature is the neighborhood's lungs.',
    tileSize: 4,
    costs: {
      level1: { agency: 10, helping: 15, character: 5, curiosity: 10, learning: 5, problemSolving: 0 },
      level2: { agency: 25, helping: 30, character: 15, curiosity: 25, learning: 15, problemSolving: 0 },
      level3: { agency: 50, helping: 60, character: 30, curiosity: 50, learning: 30, problemSolving: 30 },
    },
    population: { level1: 7, level2: 16, level3: 28 },
    spriteKeys: { level1: 'park_l1', level2: 'park_l2', level3: 'park_l3' },
  },
  {
    name: 'Sports Field',
    category: 'landmark',
    description: 'Leagues and tournaments unite the block.',
    loreText: 'Competition builds character.',
    tileSize: 4,
    costs: {
      level1: { agency: 15, helping: 20, character: 10, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 30, helping: 40, character: 25, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 60, helping: 80, character: 50, curiosity: 0, learning: 0, problemSolving: 60 },
    },
    population: { level1: 9, level2: 20, level3: 34 },
    spriteKeys: { level1: 'sports_field_l1', level2: 'sports_field_l2', level3: 'sports_field_l3' },
  },
  {
    name: 'Police Station',
    category: 'landmark',
    description: 'Community-oriented policing for a safe block.',
    loreText: 'Safety is everyone's responsibility.',
    tileSize: 2,
    costs: {
      level1: { agency: 15, helping: 10, character: 20, curiosity: 0, learning: 0, problemSolving: 0 },
      level2: { agency: 30, helping: 25, character: 40, curiosity: 0, learning: 0, problemSolving: 0 },
      level3: { agency: 60, helping: 50, character: 80, curiosity: 0, learning: 0, problemSolving: 60 },
    },
    population: { level1: 6, level2: 14, level3: 24 },
    spriteKeys: { level1: 'police_station_l1', level2: 'police_station_l2', level3: 'police_station_l3' },
  },

  // ── PREMIUM (250-400 pts total) ───────────────────────────────────────────
  {
    name: 'Town Hall',
    category: 'premium',
    description: 'The seat of democratic governance on the block.',
    loreText: 'Every voice matters here.',
    tileSize: 4,
    costs: {
      level1: { agency: 50, helping: 50, character: 50, curiosity: 50, learning: 50, problemSolving: 50 },
      level2: { agency: 80, helping: 80, character: 80, curiosity: 80, learning: 80, problemSolving: 80 },
      level3: { agency: 120, helping: 120, character: 120, curiosity: 120, learning: 120, problemSolving: 120 },
    },
    population: { level1: 20, level2: 40, level3: 70 },
    spriteKeys: { level1: 'town_hall_l1', level2: 'town_hall_l2', level3: 'town_hall_l3' },
  },
  {
    name: 'Cultural Center',
    category: 'premium',
    description: 'Celebrates the diversity of the block.',
    loreText: 'Every culture adds color to the community.',
    tileSize: 4,
    costs: {
      level1: { agency: 30, helping: 60, character: 40, curiosity: 50, learning: 40, problemSolving: 30 },
      level2: { agency: 50, helping: 90, character: 65, curiosity: 80, learning: 65, problemSolving: 50 },
      level3: { agency: 80, helping: 130, character: 100, curiosity: 120, learning: 100, problemSolving: 70 },
    },
    population: { level1: 18, level2: 36, level3: 60 },
    spriteKeys: { level1: 'cultural_center_l1', level2: 'cultural_center_l2', level3: 'cultural_center_l3' },
  },
  {
    name: 'Innovation Hub',
    category: 'premium',
    description: 'Where ideas become solutions.',
    loreText: 'The future is built right here.',
    tileSize: 4,
    costs: {
      level1: { agency: 40, helping: 20, character: 20, curiosity: 60, learning: 60, problemSolving: 50 },
      level2: { agency: 65, helping: 35, character: 35, curiosity: 95, learning: 95, problemSolving: 75 },
      level3: { agency: 100, helping: 50, character: 50, curiosity: 140, learning: 140, problemSolving: 120 },
    },
    population: { level1: 16, level2: 32, level3: 55 },
    spriteKeys: { level1: 'innovation_hub_l1', level2: 'innovation_hub_l2', level3: 'innovation_hub_l3' },
  },
  {
    name: 'Public Art Installation',
    category: 'premium',
    description: 'A landmark artwork that defines the block's identity.',
    loreText: 'Art tells the story we share.',
    tileSize: 2,
    costs: {
      level1: { agency: 40, helping: 40, character: 50, curiosity: 60, learning: 30, problemSolving: 30 },
      level2: { agency: 65, helping: 65, character: 80, curiosity: 95, learning: 50, problemSolving: 50 },
      level3: { agency: 100, helping: 100, character: 120, curiosity: 140, learning: 80, problemSolving: 60 },
    },
    population: { level1: 15, level2: 28, level3: 48 },
    spriteKeys: { level1: 'public_art_l1', level2: 'public_art_l2', level3: 'public_art_l3' },
  },
];

async function seedBuildings() {
  let inserted = 0;
  let skipped = 0;

  for (const data of BUILDINGS) {
    const existing = await BuildingTemplate.findOne({ name: data.name });
    if (existing) {
      skipped++;
      continue;
    }
    await BuildingTemplate.create(data);
    inserted++;
  }

  return { inserted, skipped, total: BUILDINGS.length };
}

// Allow direct execution: node src/seeds/buildings.js
if (require.main === module) {
  require('dotenv').config();
  const { connect } = require('../config/database');

  connect()
    .then(() => seedBuildings())
    .then((result) => {
      console.log('Seed complete:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedBuildings, BUILDINGS };
