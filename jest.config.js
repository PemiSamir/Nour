/**
 * Three Jest projects:
 * - "unit": Node environment, for pure functions with no database and no React Native.
 * - "db": Node environment, for SQL and data-layer tests running on sql.js.
 * - "ui": the jest-expo preset, for React Native component tests.
 */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'jest-expo/node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
    },
    {
      displayName: 'db',
      preset: 'jest-expo/node',
      testMatch: ['<rootDir>/tests/db/**/*.test.ts'],
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/tests/ui/**/*.test.tsx'],
      moduleNameMapper: {
        '\\.css$': '<rootDir>/tests/style-stub.js',
      },
    },
  ],
};
