import type { ReactNode } from 'react'

export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
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
    </div>
  )
}
