// vitest.config.mjs — isolates the backend unit tests from the app's Vite/
// electron-renderer config, which aliases Node built-ins (e.g. crypto) to a
// browser shim that breaks under Node ESM. Tests run in a plain Node env so
// `node:crypto` and friends resolve natively.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/lib/**/*.test.mjs'],
  },
});
