/**
 * Test stub for the `virtual:pwa-register/react` module (which only exists when
 * vite-plugin-pwa runs). Aliased in vitest.config.ts. Tests drive it via
 * `setMockRegisterState`.
 */
import { vi } from 'vitest'

interface MockState {
  needRefresh: boolean
  updateServiceWorker: (reload?: boolean) => void
  setNeedRefresh: (v: boolean) => void
}

const state: MockState = {
  needRefresh: false,
  updateServiceWorker: vi.fn(),
  setNeedRefresh: vi.fn(),
}

export function setMockRegisterState(next: Partial<MockState>): void {
  Object.assign(state, next)
}

export function useRegisterSW() {
  return {
    needRefresh: [state.needRefresh, state.setNeedRefresh] as const,
    offlineReady: [false, vi.fn()] as const,
    updateServiceWorker: state.updateServiceWorker,
  }
}
