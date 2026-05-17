import type { RiotApiHost } from './riotApiAdapter'

export function createBrowserRiotApiHost(apiKey = import.meta.env.VITE_RIOT_API_KEY): RiotApiHost | null {
  if (!apiKey) return null

  return {
    apiKey,
    baseUrl: import.meta.env.VITE_RIOT_API_BASE_URL,
    async fetchJson<T>(url: string, init?: { headers?: Record<string, string> }): Promise<T | null> {
      try {
        const response = await fetch(url, {
          headers: {
            ...init?.headers,
          },
        })

        if (!response.ok) return null
        return await response.json() as T
      } catch {
        return null
      }
    },
  }
}
