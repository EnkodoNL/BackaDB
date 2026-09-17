module.exports = {
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { tsconfig: { rootDir: ".", types: ["node", "jest"] } },
    ],
  },
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/index.ts"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleFileExtensions: ["ts", "js", "json", "node"],
};
