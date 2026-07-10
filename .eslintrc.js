module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      2,
      { args: "all", argsIgnorePattern: "^_" },
    ],
    "no-control-regex": 0,
  },
  overrides: [
    {
      files: ["src/lang/en.ts"],
      rules: {
        // Disable sentence-case rule for regex patterns (lines 33-38, 42)
        // These are technical regex patterns, not UI text
        "obsidianmd/ui/sentence-case-locale-module": "off",
      },
    },
    {
      files: ["src/modals/date-picker.ts"],
      rules: {
        // Disable sentence-case rule for Moment.js format string (line 65)
        // This is a technical format specification, not UI text
        "obsidianmd/ui/sentence-case": "off",
      },
    },
    {
      files: ["tests/__mocks__/**/*.ts", "tests/setup.ts"],
      rules: {
        // Mocks intentionally stub out the Obsidian API with empty methods
        // and unused parameters to match its signatures.
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
    {
      files: ["tests/**/*.test.ts"],
      rules: {
        // vi.spyOn(...).mockImplementation(() => {}) to silence console
        // output during assertions is a standard, legitimate test pattern.
        "@typescript-eslint/no-empty-function": "off",
      },
    },
  ],
};
