import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      'obsidian': path.resolve(__dirname, './tests/__mocks__/obsidian.ts'),
      'obsidian-daily-notes-interface': path.resolve(__dirname, './tests/__mocks__/obsidian-daily-notes-interface.ts'),
    },
  },
});
