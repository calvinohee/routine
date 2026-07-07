import { afterEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateToast, UpdateToastView } from '../UpdateToast'
import { setMockRegisterState } from '../../test/pwa-register-stub'

describe('UpdateToastView', () => {
  test('hidden when no update is waiting', () => {
    const { container } = render(
      <UpdateToastView show={false} onReload={() => undefined} onDismiss={() => undefined} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('shows the update prompt and wires the buttons when an update is ready', async () => {
    const user = userEvent.setup()
    const onReload = vi.fn()
    const onDismiss = vi.fn()
    render(<UpdateToastView show onReload={onReload} onDismiss={onDismiss} />)

    expect(screen.getByText(/new version is ready/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(onReload).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

describe('UpdateToast container', () => {
  afterEach(() => setMockRegisterState({ needRefresh: false, updateServiceWorker: vi.fn() }))

  test('nothing renders when no update is waiting', () => {
    setMockRegisterState({ needRefresh: false })
    const { container } = render(<UpdateToast />)
    expect(container).toBeEmptyDOMElement()
  })

  test('reloads the service worker when the ready toast is tapped', async () => {
    const updateServiceWorker = vi.fn()
    setMockRegisterState({ needRefresh: true, updateServiceWorker })
    const user = userEvent.setup()
    render(<UpdateToast />)
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })
})
