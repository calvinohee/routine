import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AdapalenePhase, DayType, Settings, Weekday } from '../../../engine/types'
import { ADAPALENE_PHASES, DAY_TYPES, WEEKDAYS } from '../../../engine/types'
import { advanceToPhase, phaseGuidance } from '../../../engine/adapalene'
import { PHASE_LABELS } from '../../../lib/labels'
import { db } from '../../../db/db'
import { putSettings } from '../../../db/state'
import { exportPayload, importPayload, validatePayload } from '../../../lib/backup'
import { sydneyToday } from '../../../hooks/useToday'

function save(settings: Settings) {
  void putSettings(db, settings)
}

// ── Small primitives ─────────────────────────────────────────────────────────

export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  unit?: string
}) {
  return (
    <div className="stepper-row">
      <span className="stepper-label">{label}</span>
      <div className="stepper">
        <button aria-label={`decrease ${label}`} onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}>
          −
        </button>
        <span className="stepper-value">
          {value}
          {unit}
        </span>
        <button aria-label={`increase ${label}`} onClick={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))}>
          +
        </button>
      </div>
    </div>
  )
}

// ── Adapalene phase ──────────────────────────────────────────────────────────

export function AdapalenePhaseSettings({ settings }: { settings: Settings }) {
  const [pendingPhase, setPendingPhase] = useState<AdapalenePhase | null>(null)

  async function confirmPhase(phase: AdapalenePhase) {
    const { state, transition } = advanceToPhase(settings.adapalene, phase, sydneyToday())
    await db.adapalenePhaseHistory.add(transition)
    await putSettings(db, { ...settings, adapalene: state })
    setPendingPhase(null)
  }

  return (
    <div className="card">
      <h3>Adapalene phase</h3>
      <p className="settings-hint">{phaseGuidance(settings.adapalene.phase)}</p>
      {ADAPALENE_PHASES.map((phase) => {
        const current = settings.adapalene.phase === phase
        const pending = pendingPhase === phase
        return (
          <div key={phase}>
            <button
              className={`option-row ${current ? 'selected' : ''}`}
              onClick={() => (current ? undefined : setPendingPhase(pending ? null : phase))}
            >
              <span>
                {PHASE_LABELS[phase]}
                {current && <span className="opt-desc">Current phase</span>}
              </span>
            </button>
            {pending && !current && (
              <div className="reenable-confirm">
                <span>Move to “{PHASE_LABELS[phase]}”? Progression is always your call.</span>
                <div className="chips" style={{ marginTop: 8 }}>
                  <button className="chip small" onClick={() => setPendingPhase(null)}>
                    Cancel
                  </button>
                  <button className="chip small selected" onClick={() => void confirmPhase(phase)}>
                    Move phase
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Quotas ───────────────────────────────────────────────────────────────────

export function QuotaSettings({ settings }: { settings: Settings }) {
  const q = settings.quotas
  const set = (key: keyof Settings['quotas']) => (v: number) =>
    save({ ...settings, quotas: { ...q, [key]: v } })
  return (
    <div className="card">
      <h3>Weekly quotas (rolling 7 days)</h3>
      <Stepper label="BHA nights (floor)" value={q.bha} onChange={set('bha')} min={0} max={4} />
      <Stepper label="TN nights" value={q.tn} onChange={set('tn')} min={0} max={4} />
      <Stepper label="Clay masks" value={q.clay} onChange={set('clay')} min={0} max={3} />
      <Stepper label="VC100 masks" value={q.vc100} onChange={set('vc100')} min={0} max={3} />
    </div>
  )
}

// ── Mask days + weekly schedule ──────────────────────────────────────────────

const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

const DAY_TYPE_SHORT: Record<DayType | 'outdoor-run-day', string> = {
  'gym-office': 'Gym + office',
  office: 'Office',
  wfh: 'WFH',
  outdoor: 'Outdoors',
  'rest-indoors': 'Rest',
  'outdoor-run-day': 'Run day',
}

export function ScheduleSettings({ settings }: { settings: Settings }) {
  const [editingDay, setEditingDay] = useState<Weekday | null>(null)

  function setMask(mask: 'clay' | 'vc100', day: Weekday) {
    save({ ...settings, preassigned: { ...settings.preassigned, [mask]: day } })
  }

  return (
    <>
      <div className="card">
        <h3>Pre-assigned mask days</h3>
        {(['clay', 'vc100'] as const).map((mask) => (
          <div key={mask} className="stepper-row">
            <span className="stepper-label">{mask === 'clay' ? 'Clay mask' : 'VC100 mask'}</span>
            <div className="chips" style={{ margin: 0 }}>
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  className={`chip small ${settings.preassigned[mask] === day ? 'selected' : ''}`}
                  onClick={() => setMask(mask, day)}
                >
                  {WEEKDAY_SHORT[day]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Weekly schedule</h3>
        {WEEKDAYS.map((day) => (
          <div key={day}>
            <button
              className="option-row"
              onClick={() => setEditingDay(editingDay === day ? null : day)}
            >
              <span>
                {WEEKDAY_SHORT[day]}
                <span className="opt-desc">{DAY_TYPE_SHORT[settings.weeklySchedule[day]]}</span>
              </span>
            </button>
            {editingDay === day && (
              <div className="chips" style={{ padding: '0 4px 8px' }}>
                {[...DAY_TYPES.filter((d) => d !== 'gym-office'), 'outdoor-run-day' as const].map((type) => (
                  <button
                    key={type}
                    className={`chip small ${settings.weeklySchedule[day] === type ? 'selected' : ''}`}
                    onClick={() => {
                      save({
                        ...settings,
                        weeklySchedule: { ...settings.weeklySchedule, [day]: type },
                      })
                      setEditingDay(null)
                    }}
                  >
                    {DAY_TYPE_SHORT[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ── Weather thresholds + coordinates ─────────────────────────────────────────

export function WeatherSettings({ settings }: { settings: Settings }) {
  const t = settings.weatherThresholds
  const set = (key: keyof Settings['weatherThresholds']) => (v: number) =>
    save({ ...settings, weatherThresholds: { ...t, [key]: v } })
  const setCoord = (key: 'lat' | 'lon') => (v: number) =>
    save({
      ...settings,
      coordinates: { ...settings.coordinates, [key]: v, label: 'Custom' },
    })
  return (
    <>
      <div className="card">
        <h3>Weather triggers</h3>
        <p className="settings-hint">When the engine changes its suggestions.</p>
        <Stepper label="Hot day" value={t.hotTempC} onChange={set('hotTempC')} min={20} max={45} unit="°C" />
        <Stepper label="Humid day" value={t.hotHumidityPct} onChange={set('hotHumidityPct')} min={40} max={95} unit="%" />
        <Stepper label="Anti-Shine SPF" value={t.antiShineTempC} onChange={set('antiShineTempC')} min={28} max={45} unit="°C" />
        <Stepper label="Cool day" value={t.coolTempC} onChange={set('coolTempC')} min={0} max={20} unit="°C" />
        <Stepper label="Dry air" value={t.dryHumidityPct} onChange={set('dryHumidityPct')} min={10} max={60} unit="%" />
        <Stepper label="UV reapply nudge" value={t.uvReapplyEmphasis} onChange={set('uvReapplyEmphasis')} min={3} max={12} />
        <Stepper label="UV makes SPF mandatory" value={t.uvSpfMandatory} onChange={set('uvSpfMandatory')} min={1} max={8} />
      </div>
      <div className="card">
        <h3>Location ({settings.coordinates.label})</h3>
        <Stepper label="Latitude" value={settings.coordinates.lat} onChange={setCoord('lat')} min={-90} max={90} step={0.01} />
        <Stepper label="Longitude" value={settings.coordinates.lon} onChange={setCoord('lon')} min={-180} max={180} step={0.01} />
      </div>
    </>
  )
}

// ── Appearance + backup ──────────────────────────────────────────────────────

export function AppearanceBackupSettings({ settings }: { settings: Settings }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [importState, setImportState] = useState<
    | { kind: 'idle' }
    | { kind: 'error'; reason: string }
    | { kind: 'confirm'; payloadText: string; sessions: number }
    | { kind: 'done' }
  >({ kind: 'idle' })

  async function doExport() {
    const payload = await exportPayload(db)
    const json = JSON.stringify(payload, null, 1)
    const name = `regimen-backup-${payload.exportedAt.slice(0, 10)}.json`
    const file = new File([json], name, { type: 'application/json' })
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Regimen backup' })
        return
      } catch {
        // fall through to download (user may have cancelled the sheet)
      }
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const result = validatePayload(JSON.parse(text))
      if (!result.ok) {
        setImportState({ kind: 'error', reason: result.reason })
        return
      }
      setImportState({
        kind: 'confirm',
        payloadText: text,
        sessions: result.payload.sessions.length,
      })
    } catch {
      setImportState({ kind: 'error', reason: 'That file could not be read as a backup.' })
    }
  }

  async function confirmImport() {
    if (importState.kind !== 'confirm') return
    const result = validatePayload(JSON.parse(importState.payloadText))
    if (result.ok) {
      await importPayload(db, result.payload)
      setImportState({ kind: 'done' })
    }
  }

  return (
    <>
      <div className="card">
        <h3>Appearance</h3>
        <div className="chips">
          {(['system', 'light', 'dark'] as const).map((theme) => (
            <button
              key={theme}
              className={`chip ${settings.theme === theme ? 'selected' : ''}`}
              onClick={() => save({ ...settings, theme })}
            >
              {theme === 'system' ? 'Match system' : theme === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Backup</h3>
        <p className="settings-hint">
          Everything lives only on this phone — export a copy now and then.
        </p>
        <button className="primary-btn" onClick={() => void doExport()}>
          Export backup
        </button>
        <button
          className="primary-btn secondary"
          style={{ marginTop: 8 }}
          onClick={() => fileInput.current?.click()}
        >
          Import backup…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void onFilePicked(e)}
        />
        {importState.kind === 'error' && <div className="advisory">{importState.reason}</div>}
        {importState.kind === 'confirm' && (
          <div className="reenable-confirm">
            <span>
              This backup holds {importState.sessions} logged session
              {importState.sessions === 1 ? '' : 's'}. Importing REPLACES everything currently on
              this phone.
            </span>
            <div className="chips" style={{ marginTop: 8 }}>
              <button className="chip small" onClick={() => setImportState({ kind: 'idle' })}>
                Cancel
              </button>
              <button className="chip small selected" onClick={() => void confirmImport()}>
                Replace everything
              </button>
            </div>
          </div>
        )}
        {importState.kind === 'done' && <div className="advisory">Backup restored ✓</div>}
      </div>
    </>
  )
}
