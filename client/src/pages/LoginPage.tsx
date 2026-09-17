import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/profile" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(loginValue, password)
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="lumen-page lumen-auth">
      <p className="lumen-page-kicker">lumen / auth</p>
      <h1 className="lumen-page-title">
        <span>welcome</span>
        back
      </h1>

      <form className="lumen-form" onSubmit={onSubmit}>
        <label className="lumen-field">
          <span>username or email</span>
          <input
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="lumen-field">
          <span>password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="lumen-error">{error}</p> : null}
        <button className="lumen-btn" type="submit" disabled={submitting}>
          {submitting ? 'signing in…' : 'sign in'}
        </button>
      </form>

      <p className="lumen-auth-switch">
        no account? <Link to="/register">register</Link>
      </p>
    </section>
  )
}
