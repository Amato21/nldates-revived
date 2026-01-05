# Unit Tests for Natural Language Dates

## Configuration

This test suite uses **Vitest** as the testing framework for TypeScript.

### Installation

Dependencies are already installed via `npm install`. The following packages are required:
- `vitest`: Testing framework
- `@vitest/ui`: User interface for tests
- `@vitest/coverage-v8`: Code coverage tool
- `moment`: Date manipulation library (for tests)

### Structure

```
tests/
├── __mocks__/           # Mocks for external dependencies
│   ├── obsidian.ts
│   └── obsidian-daily-notes-interface.ts
├── pre-setup.ts         # Initial configuration (defines window.moment)
├── setup.ts             # Setup for each test suite
├── global-setup.ts      # Global setup
├── parser.test.ts       # Main test suite for the parser
└── README.md            # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Watch mode (auto-restart on changes)
npm run test:watch

# Interactive user interface
npm run test:ui

# With coverage report
npm run test:coverage
```

## Test Configuration

### Vitest

Configuration is located in `vitest.config.ts`. Important points:
- **Environment**: Node.js
- **Setup files**: `pre-setup.ts` is loaded first to define `window.moment` before module imports
- **Aliases**: Obsidian modules are mocked via aliases
- **Coverage**: 80% threshold for lines, functions, branches and statements

### Mocks

1. **window.moment**: Defined in `pre-setup.ts` because it's needed as soon as `chrono.ts` is imported
2. **obsidian**: Mocked to avoid real dependencies on Obsidian
3. **obsidian-daily-notes-interface**: Mocked in the same way

## Test Suite

The test suite in `parser.test.ts` covers:

### Priority 1: Basic Expressions
- `today`, `tomorrow`, `yesterday`, `now`
- Multilingual support (en, fr, de, pt, nl, es, it, ja)

### Priority 1: Simple Relative Expressions
- `in 2 days`, `in 2 weeks`, `in 3 months`, etc.
- Support for all time units
- Multilingual support

### Priority 2: Combinations
- `in 2 weeks and 3 days`
- Combinations of different units
- Multilingual support

### Priority 3: Weekdays
- `next Monday`, `last Friday`, `this Wednesday`
- With time: `next Monday at 3pm`
- Multilingual support

### Date Ranges
- `from Monday to Friday`
- `next week`
- Multilingual support

### Edge Cases and Error Handling
- Empty strings
- Invalid expressions
- Case variants
- Extra spaces
- Time component detection

## Important Notes

⚠️ **Known Issue**: Some tests may fail because:
- Date comparisons can be timing-sensitive
- Some chrono-node features may require additional configuration
- Multilingual tests depend on chrono-node configuration

### Debugging Tests

1. Run a specific test:
```bash
npm test -- --reporter=verbose parser.test.ts
```

2. See detailed errors:
```bash
npm test 2>&1 | more
```

3. Watch mode for development:
```bash
npm run test:watch
```

## Improvements Made

✅ **Date assertions with tolerance**: All tests now use `expectSameDate()` from `test-helpers.ts` which automatically handles time tolerances according to the requested precision (day, hour, minute, etc.)

✅ **Additional edge cases**: Several new tests have been added to cover:
- Expressions with large numbers
- Expressions with 0 days
- Mixed expressions (special characters, spaces)
- Date ranges with the same day
- Expressions with 24h time
- Ordinal numbers
- Expressions with "ago"

✅ **Integration tests**: New test section that verifies:
- Consistency between different parser methods
- Functioning with all configured languages
- Time component detection
- Consistency between `getParsedDate` and `getParsedDateRange`

## Test Helpers

The `tests/test-helpers.ts` file provides utility functions:
- `expectSameDate()`: Compares two dates with automatic tolerance
- `expectDateInRange()`: Verifies that a date is within a range
- `expectFutureDate()`: Verifies that a date is in the future
- `expectPastDate()`: Verifies that a date is in the past
