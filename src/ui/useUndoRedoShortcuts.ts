import { useEffect } from 'react'
import { useProjectStore } from '../store/useProjectStore'

const TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** Global Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z or Ctrl+Y (redo), skipped while a form field has focus. */
export function useUndoRedoShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isModZ = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'
      const isCtrlY = e.ctrlKey && e.key.toLowerCase() === 'y'
      if (!isModZ && !isCtrlY) return

      const active = document.activeElement
      if (active && TEXT_INPUT_TAGS.has(active.tagName)) return

      e.preventDefault()
      const { undo, redo } = useProjectStore.getState()
      if (isCtrlY || (isModZ && e.shiftKey)) {
        redo()
      } else {
        undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
