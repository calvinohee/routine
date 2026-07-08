import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Bottom sheet. Rendered through a portal to <body> so it always anchors to
 * the viewport — an animated (transformed) ancestor would otherwise capture
 * position: fixed and pin the sheet to the scrolled page instead.
 */
export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grabber" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
