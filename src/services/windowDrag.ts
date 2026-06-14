const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="dialog"]',
  '[data-no-window-drag]',
  '[data-tauri-drag-region="false"]',
].join(',')

export function shouldStartWindowDrag(target: EventTarget | null, button: number) {
  if (button !== 0 || !target || typeof (target as Element).closest !== 'function') return false
  return !(target as Element).closest(INTERACTIVE_SELECTOR)
}
