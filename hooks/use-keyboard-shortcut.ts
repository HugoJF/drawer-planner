import { useEffect, useCallback } from 'react'

interface ShortcutOptions {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

export function useKeyboardShortcut(shortcut: ShortcutOptions, callback: () => void) {
  const handler = useCallback((e: KeyboardEvent) => {
    const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey)
    const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
    const altMatch = shortcut.alt ? e.altKey : !e.altKey
    if (ctrlMatch && shiftMatch && altMatch && e.key === shortcut.key) {
      e.preventDefault()
      callback()
    }
  }, [shortcut.key, shortcut.ctrl, shortcut.shift, shortcut.alt, callback])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
