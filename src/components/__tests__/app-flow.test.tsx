import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'
import { db } from '../../db/db'

// Weather fetch is not under test — jsdom has no network.
vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
})

describe('full app flow', () => {
  test('boot → check-in → generated routine → log it', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Boots, seeds, and shows the Today screen with the adapalene status line.
    await screen.findByRole('heading', { name: 'Today' })
    await screen.findByText(/Adapalene: Full face/)
    expect(screen.getByText(/BHA 0\/3/)).toBeInTheDocument()

    // Start whichever slot is the time-aware default.
    await user.click(screen.getByRole('button', { name: /Start (morning|evening) check-in/ }))
    await screen.findByRole('heading', { name: /check-in/i })

    // Accept defaults — the common one-tap path.
    await user.click(screen.getByRole('button', { name: 'Build my routine' }))

    // Either a conflict card or a routine appears; resolve conflicts by
    // taking the recommended (first-listed) option until a routine shows.
    await waitFor(async () => {
      const log = screen.queryByRole('button', { name: 'Log it' })
      if (log) return
      const option = document.querySelector('.conflict-option')
      if (option) {
        ;(option as HTMLElement).click()
      }
      expect(screen.getByRole('button', { name: 'Log it' })).toBeInTheDocument()
    })

    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(document.querySelectorAll('.step').length).toBeGreaterThan(2)

    await user.click(screen.getByRole('button', { name: 'Log it' }))
    await screen.findByText('✓ Logged')

    const sessions = await db.sessions.toArray()
    expect(sessions.length).toBe(2) // seed session + the one just logged
  })

  test('all three tabs render their screens', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Today' })
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(await screen.findByRole('heading', { name: 'History' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Library' }))
    expect(await screen.findByRole('heading', { name: 'Library' })).toBeInTheDocument()
  })
})

describe('tab switching preserves in-flight state', () => {
  test('a generated, unlogged routine survives visiting another tab', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Today' })
    await user.click(screen.getByRole('button', { name: /Start (morning|evening) check-in/ }))
    await screen.findByRole('heading', { name: /check-in/i })
    await user.click(screen.getByRole('button', { name: 'Build my routine' }))
    await waitFor(async () => {
      const log = screen.queryByRole('button', { name: 'Log it' })
      if (log) return
      const option = document.querySelector('.conflict-option')
      if (option) (option as HTMLElement).click()
      expect(screen.getByRole('button', { name: 'Log it' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('button', { name: 'Log it' })).toBeInTheDocument()
  })
})
