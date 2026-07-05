import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryScreen } from '../library/LibraryScreen'
import { db } from '../../db/db'
import { getSettings, seedIfNeeded } from '../../db/state'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await seedIfNeeded(db)
})

describe('LibraryScreen — products', () => {
  test('re-enabling a benched product shows the reason and needs explicit confirmation', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen />)
    const anuaToggle = await screen.findByRole('switch', { name: /Anua 10% Azelaic Acid enabled/ })
    expect(anuaToggle).toHaveAttribute('aria-checked', 'false')

    await user.click(anuaToggle)
    // Still off — a reason + confirm step appeared instead.
    expect(screen.getByText(/suspected breakout trigger/)).toBeInTheDocument()
    expect((await db.products.get('anua-azelaic'))?.enabled).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Re-enable' }))
    await waitFor(async () => {
      expect((await db.products.get('anua-azelaic'))?.enabled).toBe(true)
    })
  })

  test('disabling an active product is a single tap', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen />)
    const toggle = await screen.findByRole('switch', { name: /Skin1004 Madagascar Centella/ })
    await user.click(toggle)
    await waitFor(async () => {
      expect((await db.products.get('skin1004-centella'))?.enabled).toBe(false)
    })
  })

  test('rows show a one-line function brief, not a status label', async () => {
    render(<LibraryScreen />)
    await screen.findByRole('heading', { name: 'Library' })
    // Differin's brief appears under its name; no uppercase status labels anywhere.
    expect(screen.getByText(/Adapalene retinoid — cell turnover/)).toBeInTheDocument()
    expect(document.querySelector('.product-status')).toBeNull()
  })

  test('tapping a product opens its detail sheet', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen />)
    await user.click(await screen.findByText("Paula's Choice 2% BHA Liquid Exfoliant"))
    expect(await screen.findByText(/thin layer full face/)).toBeInTheDocument()
    expect(screen.getByText(/5–10 min wait is non-negotiable/)).toBeInTheDocument()
  })
})

describe('LibraryScreen — settings', () => {
  test('quota stepper writes through to settings', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen />)
    await user.click(await screen.findByRole('button', { name: 'increase TN nights' }))
    await waitFor(async () => {
      expect((await getSettings(db)).quotas.tn).toBe(3)
    })
  })

  test('phase change asks for confirmation and records a transition', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen />)
    await user.click(await screen.findByRole('button', { name: /Full face · 2×\/week/ }))
    await user.click(screen.getByRole('button', { name: 'Move phase' }))
    await waitFor(async () => {
      expect((await getSettings(db)).adapalene.phase).toBe('full-face-2x')
      expect(await db.adapalenePhaseHistory.count()).toBe(2)
    })
  })

  test('theme choice persists', async () => {
    const user = userEvent.setup()
    render(<LibraryScreen />)
    await user.click(await screen.findByRole('button', { name: 'Dark' }))
    await waitFor(async () => {
      expect((await getSettings(db)).theme).toBe('dark')
    })
  })
})
