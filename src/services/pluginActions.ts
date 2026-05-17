export type PluginActionResult = {
  ok: boolean
  message: string
  source: 'mock' | 'plugin-host'
}

export type PluginActions = {
  applyItemLoadout: (loadoutName: string) => Promise<PluginActionResult>
  applyRunePage: (pageName: string) => Promise<PluginActionResult>
  sendChatBrief: (brief: string) => Promise<PluginActionResult>
}

export const mockPluginActions: PluginActions = {
  async applyItemLoadout(loadoutName) {
    return {
      ok: true,
      message: `已应用 ${loadoutName}`,
      source: 'mock',
    }
  },

  async applyRunePage(pageName) {
    return {
      ok: true,
      message: `已应用 ${pageName}`,
      source: 'mock',
    }
  },

  async sendChatBrief() {
    return {
      ok: true,
      message: '已模拟发送到公屏',
      source: 'mock',
    }
  },
}
