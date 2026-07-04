import type { ConflictSet } from '../engine/types'
import { Sheet } from './Sheet'

interface Props {
  conflict: ConflictSet
  onChoose: (optionId: string) => void
}

export function ConflictCards({ conflict, onChoose }: Props) {
  return (
    <Sheet>
      <h2>Your call tonight</h2>
      <p className="q-sub">{conflict.reason}.</p>
      {conflict.options.map((option) => (
        <button key={option.id} className="conflict-option" onClick={() => onChoose(option.id)}>
          <span className="co-label">{option.label}</span>
          <span className="co-cost">{option.cost}</span>
          {option.id === conflict.recommendedOptionId && (
            <span className="co-badge">Recommended</span>
          )}
        </button>
      ))}
    </Sheet>
  )
}
