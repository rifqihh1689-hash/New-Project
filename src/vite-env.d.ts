/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/** Versi aplikasi dari package.json (disuntikkan oleh Vite). */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** URL database Dexie Cloud, mis. https://zxxxxxxx.dexie.cloud. Kosong = mode lokal saja. */
  readonly VITE_DEXIE_CLOUD_URL?: string
}
