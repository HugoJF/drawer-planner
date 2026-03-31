import { useEffect, useCallback } from 'react'

export interface ShortcutOptions {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  enabled?: boolean
}

export function useKeyboardShortcut(shortcut: ShortcutOptions, callback: () => void) {
  const handler = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (shortcut.enabled === false) return
    const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey)
    const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
    const altMatch = shortcut.alt ? e.altKey : !e.altKey
    if (ctrlMatch && shiftMatch && altMatch && e.key === shortcut.key) {
      e.preventDefault()
      callback()
    }
  }, [shortcut.key, shortcut.ctrl, shortcut.shift, shortcut.alt, shortcut.enabled, callback])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
