// openManual.js — opens the bundled User Manual PDF via the device's native
// share/open sheet.
//
// The manual ships as a static asset in public/hetsa-powersuite-manual.pdf,
// which Vite copies into dist/ (and from there, `cap sync android` copies it
// into the APK's bundled web assets) — so it's physically inside the app,
// same as every icon/manifest file already in public/. No network request,
// ever, matches the offline-first promise stated in the manual itself
// (§1/§3/§19.1).
//
// Reuses the exact Filesystem + Share pattern pdfExport.js already
// established for generated result PDFs, rather than adding a new
// file-opener plugin dependency — @capacitor/filesystem and @capacitor/share
// are both already in package.json. The one difference: this asset is
// fetched from the app's own bundle (same-origin, relative to
// import.meta.env.BASE_URL so it resolves correctly under both the './'
// Android build and the '/ems-calculator/' GitHub Pages build) rather than
// generated with jsPDF.

import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const MANUAL_ASSET_PATH = 'hetsa-powersuite-manual.pdf'
const MANUAL_CACHE_NAME = 'Hetsa_PowerSuite_User_Manual.pdf'

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192 // avoid call-stack limits on String.fromCharCode for large files
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * Fetch the bundled manual PDF, write it to device cache, and hand off to
 * the native share/open sheet so the user's PDF viewer of choice opens it.
 * Throws on failure — caller is responsible for surfacing the error (see
 * Dashboard.jsx's manual button for the expected try/catch + inline message
 * pattern, consistent with the rest of the app).
 */
export async function openManual() {
  const base = import.meta.env.BASE_URL || './'
  const url = `${base}${MANUAL_ASSET_PATH}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Manual asset not found (${response.status})`)
  }
  const buffer = await response.arrayBuffer()
  const base64 = arrayBufferToBase64(buffer)

  await Filesystem.writeFile({
    path: MANUAL_CACHE_NAME,
    data: base64,
    directory: Directory.Cache,
  })

  const { uri } = await Filesystem.getUri({ path: MANUAL_CACHE_NAME, directory: Directory.Cache })

  await Share.share({
    title: MANUAL_CACHE_NAME,
    text: 'Hetsa PowerSuite \u2014 User Manual',
    url: uri,
    dialogTitle: 'Open User Manual',
  })

  return uri
}
