import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const userAgent = 'LOL-Companion-Data/0.1 (+https://github.com/ZOELIU2333/lol-companion-prototype)'

export function argValue(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

export function hasFlag(name) {
  return process.argv.includes(name)
}

export async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent } })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.json()
}

export async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent } })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.text()
}

export async function writeJson(path, payload) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`)
}

export function cleanText(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/@[A-Za-z0-9_*]+@/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
