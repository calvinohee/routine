import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryScreen } from '../history/HistoryScreen'
import { db } from '../../db/db'
import { seedIfNeeded } from '../../db/state'
import { pmSession } from '../../engine/__tests__/fixtures'
import { sydneyToday } from '../../hooks/useToday'
import { addDays } from '../../engine/dates'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await seedIfNeeded(db)
})

describe('HistoryScreen', () => {
  test('recent sessions render as day cards with night type and conflict choice', async () => {
    const yesterday = addDays(sydneyToday(), -1)
    await db.sessions.add(
      pmSession(yesterday, 'bha', {
        conflictChoices: [{ conflictId: 'two-actives', chosenOptionId: 'choose-bha' }],
      }),
    )
    render(<HistoryScreen />)
    await screen.findByText('Last 14 days')
    expect(screen.getByText('BHA night')).toBeInTheDocument()
    expect(screen.getByText(/Your call/)).toBeInTheDocument()
  })

  test('old sessions collapse into a weekly rollup that expands on tap', async () => {
    const user = userEvent.setup()
    await db.sessions.add(pmSession(addDays(sydneyToday(), -20), 'bha'))
    render(<HistoryScreen />)
    await screen.findByText('Earlier')
    const head = screen.getByRole('button', { name: /BHA ×1/ })
    expect(screen.queryByText('BHA night')).toBeNull()
    await user.click(head)
    expect(screen.getByText('BHA night')).toBeInTheDocument()
  })

  test('spot timelines show the Pair counter', async () => {
    const today = sydneyToday()
    const spot = {
      id: 'chin-spot-test',
      zone: 'chin' as const,
      type: 'spot' as const,
      startDate: addDays(today, -3),
      updates: [],
      state: 'active' as const,
    }
    await db.spots.add(spot)
    await db.sessions.bulkAdd([
      pmSession(addDays(today, -2), 'simple', { pairSpotIds: [spot.id] }),
      pmSession(addDays(today, -1), 'simple', { pairSpotIds: [spot.id] }),
    ])
    render(<HistoryScreen />)
    await screen.findByText('Spots')
    expect(screen.getByText('Pair night 2')).toBeInTheDocument()
  })

  test('adapalene phase timeline renders from the seeded transition', async () => {
    render(<HistoryScreen />)
    await screen.findByText('Adapalene journey')
    expect(screen.getByText(/Full face · 1×\/week/)).toBeInTheDocument()
  })
})
