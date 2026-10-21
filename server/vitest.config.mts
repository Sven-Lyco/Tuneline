import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: { LOG_LEVEL: 'silent', SPOTIFY_CLIENT_ID: 'test-client-id' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // index.ts only wires env, listen() and process signals; app.ts holds the server itself.
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/index.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
