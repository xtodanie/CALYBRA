/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    "<rootDir>/tests/**/*.test.ts",
    "<rootDir>/server/tests/**/*.test.ts",
    "<rootDir>/observability/tests/**/*.test.ts",
    "<rootDir>/src/**/__tests__/*.test.ts"
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/functions/",
    // "<rootDir>/calybra-database/", // Temporarily remove to allow testing validation schemas
    "<rootDir>/.next/",
    "<rootDir>/dist/",
    "<rootDir>/build/",
  ],
  // Module path aliases (mirror tsconfig paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
   // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
};
