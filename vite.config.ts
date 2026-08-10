import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this app from a /VxlanConfigurator/ subpath, but the
  // local dev server is accessed at the root — only apply the subpath base
  // to production builds, or dev-mode module resolution breaks.
  base: command === 'build' ? '/VxlanConfigurator/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}))
