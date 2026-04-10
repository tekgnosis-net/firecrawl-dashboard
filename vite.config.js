import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Read the package.json version once at config load time and inline it
// into the bundle as a literal string via `define`. Build-time only —
// semantic-release bumps package.json on every release, so the version
// shown in the UI stays in sync automatically.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } }
  },
  build: { outDir: 'dist', assetsDir: 'assets' }
})