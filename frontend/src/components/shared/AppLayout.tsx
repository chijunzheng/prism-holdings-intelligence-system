import { NavLink, Outlet, matchPath, useLocation } from 'react-router-dom'
import { Disclaimer } from './Disclaimer'
import { NotificationBell } from '../notifications/NotificationBell'
import { ProfileSwitcher } from './ProfileSwitcher'
import '../../styles/layout.css'

export function AppLayout() {
  const { pathname } = useLocation()
  const isPlanRoute = Boolean(matchPath('/signals/:signalId/plan', pathname))
  const isSignalsRoute = pathname.startsWith('/signals') && !isPlanRoute

  return (
    <div className="app-layout">
      <nav className="app-nav">
        <NavLink to="/portfolio" className="app-nav__brand">
          Prism
        </NavLink>
        <ul className="app-nav__links">
          <li>
            <NavLink
              to="/portfolio"
              className={({ isActive }) =>
                `app-nav__link${isActive ? ' app-nav__link--active' : ''}`
              }
            >
              Portfolio
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/signals"
              end
              className={() =>
                `app-nav__link${isSignalsRoute ? ' app-nav__link--active' : ''}`
              }
            >
              Signals
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/playbook"
              className={({ isActive }) =>
                `app-nav__link${isActive || isPlanRoute ? ' app-nav__link--active' : ''}`
              }
            >
              Playbook
            </NavLink>
          </li>
        </ul>
        <div className="app-nav__right">
          <NotificationBell />
          <ProfileSwitcher />
        </div>
      </nav>

      <main className="app-content">
        <Outlet />
      </main>

      <Disclaimer />
    </div>
  )
}
