/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// BarcodeDetector (https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API)
// isn't in TS's bundled DOM lib yet (Chrome/Edge/Android Chrome only, no
// Safari/iOS as of this writing) — minimal ambient type for the subset
// ScanPage.tsx actually uses, feature-detected at runtime via `'BarcodeDetector' in window`.
interface DetectedBarcode {
  rawValue: string;
}
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
