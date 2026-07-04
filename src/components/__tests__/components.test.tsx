import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionnaireSheet } from '../QuestionnaireSheet'
import { ConflictCards } from '../ConflictCards'
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
