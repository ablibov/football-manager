import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export type DragSource = { type: 'slot'; slotId: string } | { type: 'bench'; index: number; playerId: string } | { type: 'reserve'; playerId: string }
export type DropTarget = { type: 'slot'; slotId: string } | { type: 'bench'; index: number } | { type: 'reserve' } | { type: 'pitch'; x: number; y: number }

function parseTarget(el: Element | null, x: number, y: number): DropTarget | null {
  const target = el?.closest('[data-drop]') as HTMLElement | null
  if (!target) return null
  const [kind, arg] = (target.dataset.drop ?? '').split(':')
  if (kind === 'slot') return { type: 'slot', slotId: arg }
  if (kind === 'bench') return { type: 'bench', index: Number(arg) }
  if (kind === 'reserve') return { type: 'reserve' }
  if (kind === 'pitch') {
    const r = target.getBoundingClientRect()
    return { type: 'pitch', x: Math.max(4, Math.min(96, ((x - r.left) / r.width) * 100)), y: Math.max(3, Math.min(97, 100 - ((y - r.top) / r.height) * 100)) }
  }
  return null
}

/**
 * Pointer-based drag & drop that works with mouse, pen and touch.
 * A press without movement is reported as a click (tap-to-select on phones).
 */
export function useDragDrop(onDrop: (src: DragSource, dst: DropTarget) => void, onTap: (src: DragSource) => void) {
  const [ghost, setGhost] = useState<{ x: number; y: number; label: ReactNode } | null>(null)
  const state = useRef<{ src: DragSource; sx: number; sy: number; moved: boolean; label: ReactNode; id: number } | null>(null)
  const handlers = useRef({ onDrop, onTap })
  useEffect(() => {
    handlers.current = { onDrop, onTap }
  }, [onDrop, onTap])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = state.current
      if (!s || e.pointerId !== s.id) return
      if (!s.moved && Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 6) s.moved = true
      if (s.moved) {
        e.preventDefault()
        setGhost({ x: e.clientX, y: e.clientY, label: s.label })
      }
    }
    const up = (e: PointerEvent) => {
      const s = state.current
      if (!s || e.pointerId !== s.id) return
      state.current = null
      setGhost(null)
      if (!s.moved) {
        handlers.current.onTap(s.src)
        return
      }
      const el = document.elementsFromPoint(e.clientX, e.clientY).find((x) => (x as HTMLElement).dataset?.drop || x.closest('[data-drop]')) ?? null
      const dst = parseTarget(el, e.clientX, e.clientY)
      if (dst) handlers.current.onDrop(s.src, dst)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const start = useCallback((e: React.PointerEvent, src: DragSource, label: ReactNode) => {
    if (e.button !== 0) return
    state.current = { src, sx: e.clientX, sy: e.clientY, moved: false, label, id: e.pointerId }
  }, [])

  const ghostEl = ghost ? (
    <div className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2" style={{ left: ghost.x, top: ghost.y }}>
      {ghost.label}
    </div>
  ) : null

  return { start, ghostEl, dragging: !!ghost }
}

