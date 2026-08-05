import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import obfuscator from "rollup-plugin-obfuscator";
import { readFileSync } from "node:fs";

// Single source of truth for the app's version string, injected at build time.
// Read from package.json so App.jsx / whatsNew.js / eslint.config.js's __APP_VERSION__
// global all resolve to the same value without hand-editing it in multiple places.
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  build: {
    // Generated for every build so a release crash trace can be decoded later.
    // NEVER let the .map file reach `www/`/the shipped APK — see the release
    // procedure note: copy it out to a private location before `cap sync`.
    sourcemap: true,

    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          jspdf: ["jspdf"],
        },
      },
      plugins: [
        // Obfuscation applies ONLY to the explicit "release" mode
        // (npm run build:release). The default `npm run build` — used for
        // assembleDebug and everyday dev-cycle testing — is completely
        // unaffected. Added 2026-08-05; see architecture.md §6 and
        // debt.md's 2026-08-05 entries for the full writeup.
        mode === "release" &&
          obfuscator({
            sourceMap: true, // chains through Rollup's own sourcemap output above

            // Moderate strength: a real deterrent against casual copy/paste of
            // engine logic, without inflating bundle size or risking the
            // PERF-1 <=3s cold-start budget on the reference device.
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.4,
            deadCodeInjection: false, // would grow bundle size for little added protection
            identifierNamesGenerator: "hexadecimal",
            renameGlobals: false, // Capacitor's JS<->native bridge depends on reachable globals
            stringArray: true,
            stringArrayEncoding: ["base64"],
            stringArrayThreshold: 0.75,
            splitStrings: true,
            splitStringsChunkLength: 8,
            numbersToExpressions: true,
            simplify: true,
            selfDefending: true,
            disableConsoleOutput: false, // keep console.error alive for field crash reports
          }),
      ].filter(Boolean),
    },
  },
}));
