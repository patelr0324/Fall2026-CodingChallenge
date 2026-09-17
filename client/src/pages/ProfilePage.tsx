import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function ProfilePage() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / profile</p>
        <p className="lumen-page-blurb">loading…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / profile</p>
        <h1 className="lumen-page-title">
          <span>not</span>
          signed in
        </h1>
        <p className="lumen-page-blurb">
          <Link to="/login">sign in</Link> or <Link to="/register">create an account</Link> to
          save collections.
        </p>
      </section>
    )
  }

  return (
    <section className="lumen-page">
      <p className="lumen-page-kicker">lumen / profile</p>
      <h1 className="lumen-page-title">
        <span>hey</span>
        {user.username}
      </h1>
      <p className="lumen-page-blurb">{user.email}</p>
      <button className="lumen-btn lumen-btn-ghost" type="button" onClick={logout}>
        sign out
      </button>
    </section>
  )
}
