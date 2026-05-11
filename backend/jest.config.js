module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['tests/webhook-security.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
  ],
};
