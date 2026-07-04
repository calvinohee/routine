export type Tab = 'today' | 'history' | 'library'

const ICONS: Record<Tab, string> = {
  // Simple SF-Symbols-style outlines drawn as paths.
  today:
    'M12 2.75a.75.75 0 01.75.75v1a.75.75 0 01-1.5 0v-1a.75.75 0 01.75-.75zm0 13.5a4.25 4.25 0 100-8.5 4.25 4.25 0 000 8.5zm0 3a.75.75 0 01.75.75v1a.75.75 0 01-1.5 0v-1a.75.75 0 01.75-.75zM3.5 11.25a.75.75 0 000 1.5h1a.75.75 0 000-1.5h-1zm16 0a.75.75 0 000 1.5h1a.75.75 0 000-1.5h-1zM5.55 5.55a.75.75 0 011.06 0l.71.7A.75.75 0 016.26 7.3l-.71-.7a.75.75 0 010-1.06zm11.13 11.13a.75.75 0 011.06 0l.71.71a.75.75 0 11-1.06 1.06l-.71-.71a.75.75 0 010-1.06zm1.77-11.13a.75.75 0 010 1.06l-.71.7a.75.75 0 11-1.06-1.06l.71-.7a.75.75 0 011.06 0zM7.32 16.68a.75.75 0 010 1.06l-.71.71a.75.75 0 11-1.06-1.06l.71-.71a.75.75 0 011.06 0z',
  history:
    'M12 4.25a7.75 7.75 0 105.48 13.23.75.75 0 10-1.06-1.06A6.25 6.25 0 1112 5.75c1.73 0 3.3.7 4.43 1.84l-1.62 1.62a.5.5 0 00.35.85h3.59a.5.5 0 00.5-.5V5.97a.5.5 0 00-.85-.36l-1.11 1.11A7.72 7.72 0 0012 4.25zm.75 3.9a.75.75 0 00-1.5 0v4.16c0 .2.08.39.22.53l2.5 2.5a.75.75 0 101.06-1.06l-2.28-2.28V8.15z',
  library:
    'M6.75 4A2.75 2.75 0 004 6.75v10.5A2.75 2.75 0 006.75 20h10.5A2.75 2.75 0 0020 17.25V6.75A2.75 2.75 0 0017.25 4H6.75zM5.5 6.75c0-.69.56-1.25 1.25-1.25h10.5c.69 0 1.25.56 1.25 1.25v10.5c0 .69-.56 1.25-1.25 1.25H6.75c-.69 0-1.25-.56-1.25-1.25V6.75zM8 8.75A.75.75 0 018.75 8h6.5a.75.75 0 010 1.5h-6.5A.75.75 0 018 8.75zm0 3.5a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-6.5a.75.75 0 01-.75-.75zm.75 2.75a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z',
}

const LABELS: Record<Tab, string> = { today: 'Today', history: 'History', library: 'Library' }

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tab-bar">
      {(Object.keys(LABELS) as Tab[]).map((t) => (
        <button
          key={t}
          className={`tab-btn ${tab === t ? 'active' : ''}`}
          onClick={() => onChange(t)}
          aria-current={tab === t ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={ICONS[t]} />
          </svg>
          {LABELS[t]}
        </button>
      ))}
    </nav>
  )
}
