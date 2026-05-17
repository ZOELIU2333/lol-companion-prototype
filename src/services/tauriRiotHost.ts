import { invoke, isTauri } from '@tauri-apps/api/core'
import type { RiotApiHost } from './riotApiAdapter'

export function createTauriRiotApiHost(): RiotApiHost | null {
  if (!isTauri()) return null

  return {
    baseUrl: import.meta.env.VITE_RIOT_API_BASE_URL,
    async fetchJson<T>(url: string): Promise<T | null> {
      try {
        return await invoke<T | null>('riot_api_get', { url })
      } catch {
        return null
      }
    },
  }
}
