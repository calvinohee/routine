import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionnaireSheet } from '../QuestionnaireSheet'
import { ConflictCards } from '../ConflictCards'
import { CountdownTimer } from '../CountdownTimer'
import { RoutineView } from '../RoutineView'
import { defaultSlot, sydneyHour } from '../../hooks/useToday'
import { makeSettings } from '../../engine/__tests__/fixtures'
import type { Answers, ConflictSet } from '../../engine/types'

const MONDAY = '2026-07-06' // gym-office in the seed schedule

describe('QuestionnaireSheet — AM flow', () => {
  test('day type is pre-selected from the weekly schedule; one tap path works', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(a: Answers) => void>()
    render(
      <QuestionnaireSheet
        slot="am"
        date={MONDAY}
        settings={makeSettings()}
        activeSpots={[]}
        onSubmit={onSubmit}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Gym + office' })).toHaveClass('selected')
    // Adapalene question appears while phase < established.
    expect(screen.getByText(/Adapalene site overnight/)).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Build my routine' }))
    expect(onSubmit).toHaveBeenCalledOnce()
    const answers = onSubmit.mock.calls[0]?.[0]
    expect(answers).toMatchObject({
      slot: 'am',
      dayType: 'gym-office',
      skinStates: ['clear'],
      patches: 'none',
      adapaleneReport: 'looked-fine',
    })
  })

  test('selecting new spot opens the zone picker inline and reports the zone', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(a: Answers) => void>()
    render(
      <QuestionnaireSheet
        slot="am"
        date={MONDAY}
        settings={makeSettings()}
        activeSpots={[]}
        onSubmit={onSubmit}
        onClose={() => undefined}
      />,
    )

    expect(screen.queryByText('Where?')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'New spot' }))
    expect(screen.getByText('Where?')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Chin' }))
    await user.click(screen.getByRole('button', { name: 'Build my routine' }))

    const answers = onSubmit.mock.calls[0]?.[0]
    expect(answers?.newSpots).toEqual([{ zone: 'chin', type: 'spot' }])
    expect(answers?.skinStates).toContain('new-spot')
  })

  test('adapalene question disappears once established', () => {
    const settings = makeSettings({
      adapalene: {
        phase: 'established',
        phaseStart: '2026-06-01',
        lastApplication: '2026-07-01',
        firstFullFace: '2026-04-01',
      },
    })
    render(
      <QuestionnaireSheet
        slot="am"
        date={MONDAY}
        settings={settings}
        activeSpots={[]}
        onSubmit={() => undefined}
        onClose={() => undefined}
      />,
    )
    expect(screen.queryByText(/Adapalene site/)).toBeNull()
  })
})

describe('QuestionnaireSheet — PM flow', () => {
  test('tracked spots surface as better/same/worse chips', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn<(a: Answers) => void>()
    render(
      <QuestionnaireSheet
        slot="pm"
        date={MONDAY}
        settings={makeSettings()}
        activeSpots={[
          {
            id: 'chin-spot-2026-07-01',
            zone: 'chin',
            type: 'spot',
            startDate: '2026-07-01',
            updates: [],
            state: 'active',
          },
        ]}
        onSubmit={onSubmit}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByText('Tracked spots')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Better' }))
    await user.click(screen.getByRole('button', { name: 'Build my routine' }))
    const answers = onSubmit.mock.calls[0]?.[0]
    expect(answers && 'spotUpdates' in answers ? answers.spotUpdates : []).toEqual([
      { spotId: 'chin-spot-2026-07-01', status: 'better' },
    ])
  })

  test('purge options are offered during adapalene phases', () => {
    render(
      <QuestionnaireSheet
        slot="pm"
        date={MONDAY}
        settings={makeSettings()}
        activeSpots={[]}
        onSubmit={() => undefined}
        onClose={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: 'Purge activity' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'True breakout' })).toBeDefined()
  })
})

describe('ConflictCards', () => {
  const conflict: ConflictSet = {
    id: 'two-actives-due-2026-07-06',
    reason: 'BHA and TN are both behind quota and both fit tonight',
    options: [
      { id: 'choose-bha', label: 'BHA night', cost: 'TN stays behind', nightType: 'bha', effects: [] },
      { id: 'choose-tn', label: 'TN night', cost: 'BHA stays behind', nightType: 'tn', effects: [] },
    ],
    recommendedOptionId: 'choose-bha',
  }

  test('shows options with costs and the recommended badge, and reports the tap', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn<(id: string) => void>()
    render(<ConflictCards conflict={conflict} onChoose={onChoose} />)

    expect(screen.getByText('BHA night')).toBeDefined()
    expect(screen.getByText('TN stays behind')).toBeDefined()
    expect(screen.getByText('Recommended')).toBeDefined()

    await user.click(screen.getByText('TN night'))
    expect(onChoose).toHaveBeenCalledWith('choose-tn')
  })
})

describe('CountdownTimer persistence', () => {
  test('idle by default', () => {
    localStorage.clear()
    render(<CountdownTimer minutes={10} />)
    expect(screen.getByRole('button', { name: /Start 10:00 timer/ })).toBeInTheDocument()
  })

  test('resumes a running timer from storage (survives unmount/remount)', () => {
    localStorage.setItem('regimen-timer-wait', String(Date.now() + 5 * 60 * 1000))
    render(<CountdownTimer minutes={10} />)
    expect(screen.getByText(/^[45]:\d{2}$/)).toBeInTheDocument()
    localStorage.clear()
  })

  test('a timer that finished while away shows Done', () => {
    localStorage.setItem('regimen-timer-wait', String(Date.now() - 60 * 1000))
    render(<CountdownTimer minutes={10} />)
    expect(screen.getByText(/Done ✓/)).toBeInTheDocument()
    localStorage.clear()
  })

  test('a long-expired timer resets to idle', () => {
    localStorage.setItem('regimen-timer-wait', String(Date.now() - 2 * 60 * 60 * 1000))
    render(<CountdownTimer minutes={10} />)
    expect(screen.getByRole('button', { name: /Start 10:00 timer/ })).toBeInTheDocument()
    localStorage.clear()
  })

  test('tapping start persists the end time', async () => {
    localStorage.clear()
    const user = userEvent.setup()
    render(<CountdownTimer minutes={10} />)
    await user.click(screen.getByRole('button', { name: /Start 10:00 timer/ }))
    const stored = Number(localStorage.getItem('regimen-timer-wait'))
    expect(stored).toBeGreaterThan(Date.now() + 9 * 60 * 1000)
    localStorage.clear()
  })
})

describe('RoutineView timers and leave-on remarks', () => {
  const step = (over: Partial<import('../../engine/types').RoutineStep>) => ({
    kind: 'product' as const,
    productId: 'x',
    title: 'X',
    purpose: '',
    technique: '',
    waitMinutes: 0,
    ...over,
  })
  const routine = (steps: import('../../engine/types').RoutineStep[]) => ({
    nightType: 'vc100' as const,
    steps,
    advisories: [],
    pairSpotIds: [],
  })

  test('steps over a minute get their own timer (masks, SPF set time)', () => {
    localStorage.clear()
    render(
      <RoutineView
        routine={routine([
          step({ productId: 'vc100-sheet-mask', title: 'VC100', waitMinutes: 15, leaveOn: '10–15 minutes on' }),
        ])}
        logged
        onLog={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: 'Start 15:00 timer' })).toBeInTheDocument()
    expect(screen.getByText(/10–15 minutes on/)).toBeInTheDocument()
  })

  test('one-minute-or-less steps show the remark but no timer', () => {
    localStorage.clear()
    render(
      <RoutineView
        routine={routine([
          step({ productId: 'pc-skin-balancing-toner', title: 'Toner', waitMinutes: 1, leaveOn: 'about 1 minute to absorb' }),
        ])}
        logged
        onLog={() => undefined}
      />,
    )
    expect(screen.getByText(/about 1 minute to absorb/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /timer/ })).toBeNull()
  })

  test('the BHA step does not duplicate the dedicated wait-step timer', () => {
    localStorage.clear()
    render(
      <RoutineView
        routine={routine([
          step({ productId: 'pc-bha', title: 'BHA', waitMinutes: 10 }),
          step({ kind: 'wait', productId: null, title: 'Wait 5–10 minutes', waitMinutes: 10 }),
        ])}
        logged
        onLog={() => undefined}
      />,
    )
    expect(screen.getAllByRole('button', { name: /Start 10:00 timer/ })).toHaveLength(1)
  })

  test('fractional-minute timers format properly (Benzac 90 seconds)', () => {
    localStorage.clear()
    render(
      <RoutineView
        routine={routine([
          step({ productId: 'benzac-wash-5', title: 'Benzac', waitMinutes: 1.5, leaveOn: '60–90 seconds, then rinse' }),
        ])}
        logged
        onLog={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: 'Start 1:30 timer' })).toBeInTheDocument()
  })
})

describe('useToday time handling', () => {
  test('midnight in Sydney is hour 0, defaulting to the morning slot', () => {
    // 14:00 UTC == 00:00 AEST (winter, UTC+10).
    const midnightSydney = new Date('2026-07-06T14:00:00Z')
    expect(sydneyHour(midnightSydney)).toBe(0)
    expect(defaultSlot(midnightSydney)).toBe('am')
  })

  test('evening hours default to the PM slot', () => {
    const eveningSydney = new Date('2026-07-06T09:00:00Z') // 19:00 AEST
    expect(sydneyHour(eveningSydney)).toBe(19)
    expect(defaultSlot(eveningSydney)).toBe('pm')
  })
})

describe('Sheet anchoring', () => {
  test('sheets portal to <body> so animated ancestors can never displace them', () => {
    render(
      <QuestionnaireSheet
        slot="pm"
        date={MONDAY}
        settings={makeSettings()}
        activeSpots={[]}
        onSubmit={() => undefined}
        onClose={() => undefined}
      />,
    )
    const backdrop = document.querySelector('.sheet-backdrop')
    expect(backdrop?.parentElement).toBe(document.body)
  })
})
