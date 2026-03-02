import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import '../../styles/app-shell.css'

const RailIcons = {
  expand: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 7 18 12 13 17" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </svg>
  ),
  newChat: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
} as const

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()

  const searchParams = new URLSearchParams(location.search)
  const isSidebarCollapsed = searchParams.get('sidebar') === 'collapsed'

  function navigateHomeWith(params: URLSearchParams) {
    navigate({ pathname: '/', search: `?${params.toString()}` })
  }

  function toggleSidebar() {
    const next = new URLSearchParams(location.search)
    if (isSidebarCollapsed) next.delete('sidebar')
    else next.set('sidebar', 'collapsed')
    navigateHomeWith(next)
  }

  function handleNewChat() {
    const next = new URLSearchParams(location.search)
    next.set('panel', 'sessions')
    next.set('newSession', '1')
    navigateHomeWith(next)
  }

  function handleSearch() {
    const next = new URLSearchParams(location.search)
    next.set('panel', 'sessions')
    next.set('focusSearch', '1')
    navigateHomeWith(next)
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      {isSidebarCollapsed && (
        <aside className="app-shell__rail" aria-label="Quick actions">
          <nav className="app-shell__rail-nav">
            <button
              type="button"
              className="app-shell__rail-btn"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              {RailIcons.expand}
            </button>
            <button
              type="button"
              className="app-shell__rail-btn"
              onClick={handleNewChat}
              aria-label="New session"
              title="New session"
            >
              {RailIcons.newChat}
            </button>
            <button
              type="button"
              className="app-shell__rail-btn"
              onClick={handleSearch}
              aria-label="Search"
              title="Search"
            >
              {RailIcons.search}
            </button>
          </nav>
        </aside>
      )}

      <div className="app-shell__content">
        <Outlet />
      </div>
    </div>
  )
}
