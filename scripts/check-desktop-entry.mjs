import { readFile } from 'node:fs/promises'

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')

if (/\b(?:src|href)="\/assets\//.test(html)) {
  throw new Error('Desktop entry contains absolute asset URLs; Tauri requires relative assets')
}

if (!html.includes('boot-fallback') || !html.includes('html-loaded')) {
  throw new Error('Desktop entry is missing the pre-module boot diagnostics')
}

console.log('Checked desktop entry: relative assets and boot diagnostics are present')
