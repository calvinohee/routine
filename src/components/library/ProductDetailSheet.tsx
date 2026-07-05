import type { Product } from '../../engine/types'
import { Sheet } from '../Sheet'

export function ProductDetailSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <h2>{product.name}</h2>
      <p className="q-sub">
        {product.category} · {product.format}
      </p>

      <div className="card">
        <h3>What it does</h3>
        <p style={{ margin: 0, fontSize: 15 }}>{product.function}</p>
        <div className="chips" style={{ marginTop: 10 }}>
          <span className="chip small readonly">evidence: {product.evidence}</span>
          <span className="chip small readonly">
            {product.slots.length > 0 ? product.slots.join(' + ').toUpperCase() : 'not in rotation'}
          </span>
          {product.waitMinutes > 0 && (
            <span className="chip small readonly">wait {product.waitMinutes} min</span>
          )}
        </div>
        <div className="leave-on" style={{ marginTop: 8 }}>
          ⏱ {product.leaveOn}
        </div>
      </div>

      {product.technique && (
        <div className="card">
          <h3>Technique</h3>
          <p style={{ margin: 0, fontSize: 15 }}>{product.technique}</p>
          {product.waitNote && (
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-2)' }}>
              {product.waitNote}
            </p>
          )}
        </div>
      )}

      {(product.conflictTags.length > 0 || product.conditions.length > 0) && (
        <div className="card">
          <h3>Rules it lives by</h3>
          <div className="chips">
            {product.conflictTags.map((tag) => (
              <span key={tag} className="chip small readonly">
                {tag.replaceAll('-', ' ')}
              </span>
            ))}
            {product.conditions.map((tag) => (
              <span key={tag} className="chip small readonly">
                {tag.replaceAll('-', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {product.benchedReason && <div className="advisory">Note: {product.benchedReason}</div>}

      <button className="primary-btn secondary" onClick={onClose}>
        Close
      </button>
    </Sheet>
  )
}
