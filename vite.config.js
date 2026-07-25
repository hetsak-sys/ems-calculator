import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/ems-calculator/' : './',
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
