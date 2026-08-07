/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_RIOT_API_KEY?: string
    readonly VITE_RIOT_API_BASE_URL?: string
    readonly VITE_RIOT_ACCOUNT_OVERRIDES?: string
    readonly VITE_RIOT_DEFAULT_PLATFORM?: string
    readonly VITE_RIOT_DEFAULT_REGION?: string
  }

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __LOL_COMPANION_BOOT__?: {
    ready: boolean
    report: (stage: string, detail?: string) => void
  }
}
