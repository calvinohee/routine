import { useState } from 'react'
import type { Product } from '../../engine/types'
import { db } from '../../db/db'

export function ProductRow({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const [confirming, setConfirming] = useState(false)

  async function toggle() {
    if (product.enabled) {
      await db.products.update(product.id, { enabled: false })
      return
    }
    // Benched/disabled items show their reason and need a second, explicit tap.
    if (!confirming) {
      setConfirming(true)
      return
    }
    await db.products.update(product.id, { enabled: true })
    setConfirming(false)
  }

  return (
    <div className="product-row">
      <button className="product-main" onClick={onOpen}>
        <span className="product-name">{product.name}</span>
        <span className={`product-status ${product.status}`}>{product.status}</span>
      </button>
      <button
        role="switch"
        aria-checked={product.enabled}
        aria-label={`${product.name} enabled`}
        className={`toggle ${product.enabled ? 'on' : ''}`}
        onClick={() => void toggle()}
      >
        <span className="knob" />
      </button>
      {confirming && !product.enabled && (
        <div className="reenable-confirm">
          <span>
            {product.benchedReason ?? 'This product was turned off.'} Re-enable anyway?
          </span>
          <div className="chips" style={{ marginTop: 8 }}>
            <button className="chip small" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button className="chip small selected" onClick={() => void toggle()}>
              Re-enable
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
