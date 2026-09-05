import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    isolate: true,
    pool: 'forks',
    testTimeout: 10000,
    include: [
      'tests/unit/**/*.spec.ts',
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.spec.ts',
      'tests/integration/**/*.test.ts',
      'tests/e2e/**/*.spec.ts',
      'tests/e2e/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.interface.ts',
        'src/**/*.catalog.ts',
        'src/**/index.ts',
        'src/fixtures/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@bus': path.resolve(__dirname, './src/bus'),
      '@saga': path.resolve(__dirname, './src/saga'),
      '@agents': path.resolve(__dirname, './src/agents'),
      '@tools': path.resolve(__dirname, './src/tools'),
      '@fixtures': path.resolve(__dirname, './src/fixtures')
    }
  }
});
