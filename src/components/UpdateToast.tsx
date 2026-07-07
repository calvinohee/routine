import { useRegisterSW } from 'virtual:pwa-register/react'

/** Presentational toast — prop-driven so it can be tested without a service worker. */
export function UpdateToastView({
  show,
  onReload,
  onDismiss,
}: {
  show: boolean
  onReload: () => void
  onDismiss: () => void
}) {
  if (!show) return null
  return (
    <div className="update-toast" role="status">
      <span className="update-toast-text">A new version is ready.</span>
      <div className="update-toast-actions">
        <button className="update-toast-later" onClick={onDismiss}>
          Later
        </button>
        <button className="update-toast-reload" onClick={onReload}>
          Reload
        </button>
      </div>
    </div>
  )
}

/** Container: subscribes to the service-worker update lifecycle. */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <UpdateToastView
      show={needRefresh}
      onReload={() => void updateServiceWorker(true)}
      onDismiss={() => setNeedRefresh(false)}
    />
  )
}
