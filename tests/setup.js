'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long';
process.env.MONGODB_URI = 'mongodb://localhost:27017/myblock-test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3001';
