import { Outlet, NavLink as RouterNavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const navItems = [
  { to: '/discover', label: 'discover' },
  { to: '/collections', label: 'collections' },
  { to: '/friends', label: 'friends' },
] as const

/**  decorative center bits (not navigation) */
function BitSpark() {
  return (
    <svg className="lumen-bit-svg" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 2.5 12.2 9.2 18.5 11 12.2 12.8 11 19.5 9.8 12.8 3.5 11 9.8 9.2 11 2.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="17.5" cy="4.5" r="1.1" fill="var(--coral)" />
    </svg>
  )
}

function BitPolaroid() {
  return (
    <svg className="lumen-bit-svg" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="4" y="2.5" width="14" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6" y="4.5" width="10" height="9" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="9" cy="8" r="1.2" fill="var(--teal)" />
      <path
        d="M6.5 13.2 9.2 10.8 11.4 12.6 15.5 9"
        stroke="var(--coral)"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BitSmile() {
  return (
    <svg className="lumen-bit-svg" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8.2" cy="9.2" r="1" fill="currentColor" />
      <circle cx="13.8" cy="9.2" r="1" fill="currentColor" />
      <path
        d="M7.8 12.8c1.1 1.6 2.4 2.3 3.2 2.3s2.1-.7 3.2-2.3"
        stroke="var(--lavender)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AppLayout() {
  const location = useLocation()
  const { user } = useAuth()

  return (
    <div className="lumen-viewport">
      <div className="lumen-screen">
        <header className="lumen-topbar">
          <RouterNavLink to="/collections" className="lumen-brand">
            lumen
          </RouterNavLink>

          <div className="lumen-marks" aria-hidden="true">
            <span className="lumen-bit" data-bit="spark">
              <BitSpark />
            </span>
            <span className="lumen-bit" data-bit="polaroid">
              <BitPolaroid />
            </span>
            <span className="lumen-bit" data-bit="smile">
              <BitSmile />
            </span>
          </div>

          <nav className="lumen-nav" aria-label="main">
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.to)
              return (
                <RouterNavLink
                  key={item.to}
                  to={item.to}
                  className="lumen-nav-link"
                  data-active={active ? 'true' : 'false'}
                >
                  {item.label}
                </RouterNavLink>
              )
            })}
            <RouterNavLink
              to={user ? '/profile' : '/login'}
              className="lumen-nav-link"
              data-active={
                location.pathname.startsWith('/profile') ||
                location.pathname.startsWith('/login') ||
                location.pathname.startsWith('/register')
                  ? 'true'
                  : 'false'
              }
            >
              {user ? user.username : 'sign in'}
            </RouterNavLink>
          </nav>
        </header>

        <main className="lumen-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
