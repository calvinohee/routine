import { useState } from 'react'
import type {
  AdapaleneAmReport,
  AdapalenePmReport,
  Answers,
  DayType,
  NewSpotReport,
  PatchNeed,
  RunTiming,
  Settings,
  SkinState,
  Slot,
  SpotProgress,
  Spot,
  SpotType,
  Zone,
  IsoDate,
} from '../engine/types'
import { DAY_TYPES, ZONES } from '../engine/types'
import { weekdayOf } from '../engine/dates'
import { Sheet } from './Sheet'

const DAY_TYPE_LABELS: Record<DayType, string> = {
  'gym-office': 'Gym + office',
  office: 'Office',
  wfh: 'Working from home',
  outdoor: 'Outdoors',
  'rest-indoors': 'Rest day indoors',
}

const AM_SKIN: Array<[SkinState, string]> = [
  ['clear', 'Clear'],
  ['dry-tight-cheeks', 'Cheeks dry / tight'],
  ['oily', 'Oily'],
  ['new-spot', 'New spot'],
  ['red-lump', 'Red lump'],
  ['new-pih', 'New dark mark'],
  ['irritated', 'Irritated'],
]

const ZONE_LABELS: Record<Zone, string> = {
  forehead: 'Forehead',
  nose: 'Nose',
  'cheek-l': 'Cheek L',
  'cheek-r': 'Cheek R',
  'jaw-l': 'Jaw L',
  'jaw-r': 'Jaw R',
  chin: 'Chin',
  'below-ear-l': 'Below ear L',
  'below-ear-r': 'Below ear R',
  'preauricular-l': 'Front of ear L',
  'preauricular-r': 'Front of ear R',
  neck: 'Neck',
}

const PATCH_OPTIONS: Array<[PatchNeed, string, string]> = [
  ['none', 'No patches', ''],
  ['whitehead', 'Whitehead', 'VT thin patch, wearable under daylight'],
  ['healing-spot', 'Healing / burst spot', 'VT patch protects it'],
  ['closed-lump', 'Closed lump', 'COSRX pillow barrier overnight'],
]

interface Props {
  slot: Slot
  date: IsoDate
  settings: Settings
  activeSpots: Spot[]
  onSubmit: (answers: Answers) => void
  onClose: () => void
}

export function QuestionnaireSheet({ slot, date, settings, activeSpots, onSubmit, onClose }: Props) {
  const scheduled = settings.weeklySchedule[weekdayOf(date)]
  const isRunDay = scheduled === 'outdoor-run-day'
  const defaultDayType: DayType = scheduled === 'outdoor-run-day' ? 'outdoor' : scheduled
  const adapaleneQ = settings.adapalene.phase !== 'established'

  const [dayType, setDayType] = useState<DayType>(defaultDayType)
  const [runTiming, setRunTiming] = useState<RunTiming>('no-run')
  const [followedAm, setFollowedAm] = useState<'yes' | 'modified' | 'skipped'>('yes')
  const [skin, setSkin] = useState<SkinState[]>(['clear'])
  const [newSpots, setNewSpots] = useState<NewSpotReport[]>([])
  const [spotUpdates, setSpotUpdates] = useState<Record<string, SpotProgress>>({})
  const [patches, setPatches] = useState<PatchNeed>('none')
  const [adapaleneAm, setAdapaleneAm] = useState<AdapaleneAmReport>('looked-fine')
  const [adapalenePm, setAdapalenePm] = useState<AdapalenePmReport>('no-reaction')

  const needsZones = skin.includes('new-spot') || skin.includes('red-lump')

  function toggleSkin(state: SkinState) {
    setSkin((prev) => {
      if (state === 'clear') return ['clear']
      const without = prev.filter((s) => s !== 'clear' && s !== state)
      const next = prev.includes(state) ? without : [...without, state]
      if (!next.includes('new-spot') && !next.includes('red-lump')) setNewSpots([])
      return next.length > 0 ? next : ['clear']
    })
  }

  function toggleZone(zone: Zone) {
    const type: SpotType = skin.includes('red-lump') ? 'boil' : 'spot'
    setNewSpots((prev) => {
      const existing = prev.find((s) => s.zone === zone)
      return existing ? prev.filter((s) => s.zone !== zone) : [...prev, { zone, type }]
    })
  }

  function submit() {
    if (slot === 'am') {
      onSubmit({
        slot: 'am',
        dayType,
        ...(isRunDay && dayType === 'outdoor' ? { runTiming } : {}),
        skinStates: skin,
        newSpots,
        patches,
        ...(adapaleneQ ? { adapaleneReport: adapaleneAm } : {}),
      })
    } else {
      onSubmit({
        slot: 'pm',
        followedAm,
        skinStates: skin,
        newSpots,
        spotUpdates: Object.entries(spotUpdates).map(([spotId, status]) => ({ spotId, status })),
        patches,
        ...(adapaleneQ ? { adapaleneReport: adapalenePm } : {}),
      })
    }
  }

  const pmSkinOptions: Array<[SkinState, string]> = adapaleneQ
    ? [...AM_SKIN, ['purge-activity', 'Purge activity'], ['true-breakout', 'True breakout']]
    : AM_SKIN

  return (
    <Sheet onClose={onClose}>
      <h2>{slot === 'am' ? 'Morning check-in' : 'Evening check-in'}</h2>
      <p className="q-sub">A few taps and the routine is ready.</p>

      {slot === 'am' ? (
        <section>
          <h3 className="q-heading">Today is…</h3>
          <div className="chips">
            {DAY_TYPES.map((d) => (
              <button
                key={d}
                className={`chip ${dayType === d ? 'selected' : ''}`}
                onClick={() => setDayType(d)}
              >
                {DAY_TYPE_LABELS[d]}
              </button>
            ))}
          </div>
          {isRunDay && dayType === 'outdoor' && (
            <>
              <h3 className="q-heading">Run today?</h3>
              <div className="chips">
                {(
                  [
                    ['run-am', 'Morning run'],
                    ['run-pm', 'Evening run'],
                    ['no-run', 'No run'],
                  ] as Array<[RunTiming, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={`chip ${runTiming === value ? 'selected' : ''}`}
                    onClick={() => setRunTiming(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
        <section>
          <h3 className="q-heading">Did this morning&rsquo;s routine happen?</h3>
          <div className="chips">
            {(
              [
                ['yes', 'Yes'],
                ['modified', 'Modified'],
                ['skipped', 'Skipped'],
              ] as Array<['yes' | 'modified' | 'skipped', string]>
            ).map(([value, label]) => (
              <button
                key={value}
                className={`chip ${followedAm === value ? 'selected' : ''}`}
                onClick={() => setFollowedAm(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="q-heading">{slot === 'am' ? 'Skin this morning' : 'Skin through the day'}</h3>
        <div className="chips">
          {pmSkinOptions.map(([state, label]) => (
            <button
              key={state}
              className={`chip ${skin.includes(state) ? 'selected' : ''}`}
              onClick={() => toggleSkin(state)}
            >
              {label}
            </button>
          ))}
        </div>
        {needsZones && (
          <>
            <h3 className="q-heading">Where?</h3>
            <div className="chips">
              {ZONES.map((zone) => (
                <button
                  key={zone}
                  className={`chip small ${newSpots.some((s) => s.zone === zone) ? 'selected' : ''}`}
                  onClick={() => toggleZone(zone)}
                >
                  {ZONE_LABELS[zone]}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {slot === 'pm' && activeSpots.length > 0 && (
        <section>
          <h3 className="q-heading">Tracked spots</h3>
          {activeSpots.map((spot) => (
            <div key={spot.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 4 }}>
                {ZONE_LABELS[spot.zone]} · since {spot.startDate.slice(8, 10)}/{spot.startDate.slice(5, 7)}
              </div>
              <div className="chips">
                {(['better', 'same', 'worse'] as SpotProgress[]).map((status) => (
                  <button
                    key={status}
                    className={`chip small ${spotUpdates[spot.id] === status ? 'selected' : ''}`}
                    onClick={() => setSpotUpdates((prev) => ({ ...prev, [spot.id]: status }))}
                  >
                    {status === 'better' ? 'Better' : status === 'same' ? 'Same' : 'Worse'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <h3 className="q-heading">{slot === 'am' ? 'Patches today?' : 'Patches tonight?'}</h3>
        {PATCH_OPTIONS.map(([value, label, desc]) => (
          <button
            key={value}
            className={`option-row ${patches === value ? 'selected' : ''}`}
            onClick={() => setPatches(value)}
          >
            <span>
              {label}
              {desc && <span className="opt-desc">{desc}</span>}
            </span>
          </button>
        ))}
      </section>

      {adapaleneQ && (
        <section>
          <h3 className="q-heading">
            {slot === 'am' ? 'Adapalene site overnight?' : 'Any adapalene reaction tonight?'}
          </h3>
          <div className="chips">
            {slot === 'am'
              ? (
                  [
                    ['looked-fine', 'Looked fine'],
                    ['mild-redness', 'Mild redness'],
                    ['notably-irritated', 'Notably irritated'],
                  ] as Array<[AdapaleneAmReport, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={`chip ${adapaleneAm === value ? 'selected' : ''}`}
                    onClick={() => setAdapaleneAm(value)}
                  >
                    {label}
                  </button>
                ))
              : (
                  [
                    ['no-reaction', 'No reaction'],
                    ['stinging-on-application', 'Stings when applied'],
                    ['reaction-tonight', 'Reacting tonight'],
                  ] as Array<[AdapalenePmReport, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={`chip ${adapalenePm === value ? 'selected' : ''}`}
                    onClick={() => setAdapalenePm(value)}
                  >
                    {label}
                  </button>
                ))}
          </div>
        </section>
      )}

      <button className="primary-btn" onClick={submit}>
        Build my routine
      </button>
    </Sheet>
  )
}
