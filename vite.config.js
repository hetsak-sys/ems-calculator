import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Single source of truth for the app version: package.json.
// Bumping "version" there is now the only step needed — no separate
// env var to remember to set (that's what caused the SuggestionBox
// footer to read "vunknown": VITE_APP_VERSION was never defined
// anywhere, so it silently fell back to the literal string 'unknown').
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
)

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/ems-calculator/' : './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        // Splits the two heaviest vendor deps out of the main chunk.
        // jsPDF's own dependencies (html2canvas, dompurify) already get
        // split automatically since they're dynamically imported inside
        // jspdf itself — this just adds react/react-dom and jspdf's own
        // core code as their own cacheable chunks, since those rarely
        // change version-to-version and shouldn't be re-downloaded every
        // time app code changes. See debt.md's bundle-size entry.
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'jspdf-vendor': ['jspdf'],
        },
      },
    },
  },
})
