import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const STUB = fileURLToPath(new URL('./src/test/pwa-register-stub.ts', import.meta.url))

/** Resolve the plugin-provided PWA virtual module to a test stub. */
const pwaRegisterStub = {
  name: 'pwa-register-stub',
  resolveId(id: string) {
    return id === 'virtual:pwa-register/react' ? STUB : null
  },
}

export default defineConfig({
  plugins: [react(), pwaRegisterStub],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/**/*.test.ts', 'src/engine/__tests__/**'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
})
