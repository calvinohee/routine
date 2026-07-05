import type { ResolvedRoutine } from '../engine/types'
import { CountdownTimer } from './CountdownTimer'
import { NIGHT_LABELS } from '../lib/labels'

interface Props {
  routine: ResolvedRoutine
  logged: boolean
  onLog: () => void
}

export function RoutineView({ routine, logged, onLog }: Props) {
  return (
    <div>
      {routine.nightType && (
        <div className="card">
          <h3>Tonight</h3>
          <strong style={{ fontSize: 20 }}>{NIGHT_LABELS[routine.nightType]}</strong>
        </div>
      )}

      {routine.advisories.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {routine.advisories.map((line) => (
            <div key={line} className="advisory">
              {line}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Steps</h3>
        {routine.steps.map((step, i) => (
          <div key={`${step.title}-${i}`} className={`step ${step.kind}`}>
            <div className="step-num">{i + 1}</div>
            <div className="step-body">
              <strong>{step.title}</strong>
              {step.purpose && <div className="purpose">{step.purpose}</div>}
              {step.technique && <div className="technique">{step.technique}</div>}
              {step.kind === 'wait' && (
                <div style={{ marginTop: 6 }}>
                  <CountdownTimer minutes={step.waitMinutes} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {logged ? (
        <div className="logged-banner">✓ Logged</div>
      ) : (
        <button className="primary-btn" onClick={onLog}>
          Log it
        </button>
      )}
    </div>
  )
}
