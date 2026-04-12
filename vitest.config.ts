import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: 'happy-dom',
    environmentMatchGlobs: [
      ['tests/lambda/**', 'node'],
      ['tests/security/terraform-security*', 'node'],
    ],
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/*.test.ts',
      'tests/**/*.test.ts',
      'tests/**/*.test.mjs',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/services/crypto.ts',
        'src/services/hibp.ts',
        'src/utils/passwordValidator.ts',
      ],
    },
  },
  define: {
    global: 'globalThis',
  },
})
