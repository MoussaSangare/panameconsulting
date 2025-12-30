/// <reference types="vite/client" />

interface ImportMetaEnv {
  DEV: any;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
