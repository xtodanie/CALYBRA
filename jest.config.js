/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  modulePathIgnorePatterns: [
    "<rootDir>/functions/",
    // "<rootDir>/calybra-database/", // Temporarily remove to allow testing validation schemas
    "<rootDir>/.next/",
    "<rootDir>/dist/",
    "<rootDir>/build/",
  ],
   // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
};
