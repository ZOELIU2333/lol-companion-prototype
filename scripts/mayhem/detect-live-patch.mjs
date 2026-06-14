import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { argValue, fetchText, writeJson } from './shared.mjs'

const defaultOutput = 'data/mayhem/current-patch.json'
const sources = [
  'https://lol.qq.com/gicp/news/410/37088140.html',
  'https://www.leagueoflegends.com/en-us/news/tags/patch-notes/',
]

function extractPatches(text) {
  const matches = String(text).match(/\b26\.\d{1,2}\b/g) ?? []
  return [...new Set(matches)]
}

function highestPatch(patches) {
  return patches
    .map((value) => value.split('.').map(Number))
    .sort((a, b) => b[0] - a[0] || b[1] - a[1])
    .map((parts) => parts.join('.'))[0]
}

async function readExistingPatch(output) {
  try {
    const current = JSON.parse(await readFile(output, 'utf8'))
    return typeof current.patch === 'string' ? current.patch : null
  } catch {
    return null
  }
}

async function autoDetect() {
  const detected = []
  for (const source of sources) {
    try {
      const patch = highestPatch(extractPatches(await fetchText(source)))
      if (patch) {
        console.log(`Detected ${patch} from ${source}`)
        detected.push(patch)
      } else {
        console.warn(`No 26.x patch found in ${source}`)
      }
    } catch (error) {
      console.warn(`Source unreachable: ${source} (${error.message})`)
    }
  }
  return detected
}

const output = resolve(argValue('--out', defaultOutput))
const overridePatch = argValue('--patch', null)

let patch = overridePatch

if (!patch) {
  const detected = await autoDetect()
  const unique = [...new Set(detected)]
  if (unique.length === 1) {
    patch = unique[0]
  } else if (unique.length > 1) {
    const fallback = await readExistingPatch(output)
    if (!fallback) {
      console.error(`Detection inconclusive (sources conflict: ${unique.join(', ')}) and no existing patch to fall back to.`)
      process.exit(1)
    }
    console.warn(`Detection inconclusive (sources conflict: ${unique.join(', ')}); keeping existing patch ${fallback}.`)
    patch = fallback
  } else {
    const fallback = await readExistingPatch(output)
    if (!fallback) {
      console.error('Detection inconclusive (all sources unreachable) and no existing patch to fall back to.')
      process.exit(1)
    }
    console.warn(`Detection inconclusive (all sources unreachable); keeping existing patch ${fallback}.`)
    patch = fallback
  }
}

const payload = {
  patch,
  detectedAt: new Date().toISOString(),
  sources,
}

await writeJson(output, payload)
console.log(`Wrote ${output} (patch ${patch}${overridePatch ? ', explicit override' : ', auto-detected'})`)
