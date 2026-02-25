import { NavLink, Outlet } from 'react-router-dom'
import { Disclaimer } from './Disclaimer'
import '../../styles/layout.css'

export function AppLayout() {
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
              className={({ isActive }) =>
                `app-nav__link${isActive ? ' app-nav__link--active' : ''}`
              }
            >
              Impact Analysis
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/ask"
              className={({ isActive }) =>
                `app-nav__link${isActive ? ' app-nav__link--active' : ''}`
              }
            >
              Ask Prism
            </NavLink>
          </li>
        </ul>
        <div className="app-nav__right">
          <span className="app-nav__status">
            <span className="app-nav__status-dot" />
            Markets open
          </span>
        </div>
      </nav>

      <main className="app-content">
        <Outlet />
      </main>

      <Disclaimer />
    </div>
  )
}
