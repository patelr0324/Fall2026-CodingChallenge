import { Link } from 'react-router-dom'
import { useMantineColorScheme } from '@mantine/core'
import { useAuth } from '../auth/AuthContext'

export function ProfilePage() {
  const { user, loading, logout } = useAuth()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const isLight = colorScheme === 'light'

  function toggleTheme() {
    setColorScheme(isLight ? 'dark' : 'light')
  }

  if (loading) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / account</p>
        <p className="lumen-page-blurb">loading…</p>
      </section>
    )
  }

  return (
    <section className="lumen-page">
      <p className="lumen-page-kicker">lumen / account</p>

      {user ? (
        <>
          <h1 className="lumen-page-title">
            <span>hey</span>
            {user.username}
          </h1>
          <p className="lumen-page-blurb">{user.email}</p>
        </>
      ) : (
        <>
          <h1 className="lumen-page-title">
            <span>not</span>
            signed in
          </h1>
          <p className="lumen-page-blurb">
            <Link to="/login">sign in</Link> or{' '}
            <Link to="/register">create an account</Link> to save collections.
          </p>
        </>
      )}

      <div className="lumen-settings-list">
        <div className="lumen-settings-row">
          <div className="lumen-settings-row-main">
            <div>
              <p className="lumen-settings-label">appearance</p>
              <p className="lumen-settings-hint">
                {isLight ? 'light mode' : 'dark mode'}
              </p>
            </div>
            <button
              type="button"
              className="lumen-btn lumen-btn-sm"
              onClick={toggleTheme}
            >
              {isLight ? 'use dark' : 'use light'}
            </button>
          </div>
        </div>
      </div>

      {user ? (
        <button
          className="lumen-btn lumen-btn-sm lumen-btn-danger-outline"
          type="button"
          onClick={logout}
        >
          sign out
        </button>
      ) : null}
    </section>
  )
}
