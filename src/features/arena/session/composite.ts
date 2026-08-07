import { createEmptyArenaSession, mergeArenaSession } from './fusion'
import type { ArenaSession, PartialArenaSession } from './types'
import type { ArenaSessionField, ArenaSessionPort, CompositeArenaSession } from './ports'

class PortTimeoutError extends Error {}

function errorCapabilities(fields: ArenaSessionField[]) {
  return Object.fromEntries(fields.map((field) => [field, 'error'])) as PartialArenaSession['capabilities']
}

function inferredCapabilities(port: ArenaSessionPort, partial: PartialArenaSession) {
  const capabilities: PartialArenaSession['capabilities'] = {}
  for (const field of port.fields) capabilities[field] = 'available'
  return { ...capabilities, ...partial.capabilities }
}

async function readPort(port: ArenaSessionPort, signal: AbortSignal): Promise<PartialArenaSession> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
  let abortHandler: (() => void) | undefined
  try {
    const partial = await Promise.race([
      port.read(signal),
      new Promise<never>((_, reject) => {
        timeoutId = globalThis.setTimeout(
          () => reject(new PortTimeoutError(`${port.id} timed out`)),
          port.timeoutMs ?? 2_500,
        )
      }),
      new Promise<never>((_, reject) => {
        abortHandler = () => reject(new DOMException('Arena session read aborted', 'AbortError'))
        signal.addEventListener('abort', abortHandler, { once: true })
        if (signal.aborted) abortHandler()
      }),
    ])
    return { ...partial, capabilities: inferredCapabilities(port, partial) }
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
    if (abortHandler) signal.removeEventListener('abort', abortHandler)
  }
}

export function createCompositeArenaSession(
  ports: ArenaSessionPort[],
  initial: ArenaSession = createEmptyArenaSession(),
): CompositeArenaSession {
  let current = initial
  return {
    async read(signal) {
      const results = await Promise.allSettled(ports.map((port) => readPort(port, signal)))
      results.forEach((result, index) => {
        const partial = result.status === 'fulfilled'
          ? result.value
          : { capabilities: errorCapabilities(ports[index].fields) }
        current = mergeArenaSession(current, partial)
      })
      return current
    },
  }
}
