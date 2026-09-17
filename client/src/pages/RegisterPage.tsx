import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/profile" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(username, email, password)
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'register failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="lumen-page lumen-auth">
      <p className="lumen-page-kicker">lumen / auth</p>
      <h1 className="lumen-page-title">
        <span>join</span>
        lumen
      </h1>

      <form className="lumen-form" onSubmit={onSubmit}>
        <label className="lumen-field">
          <span>username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={24}
            pattern="[a-zA-Z0-9_]+"
            required
          />
        </label>
        <label className="lumen-field">
          <span>email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="lumen-field">
          <span>password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {error ? <p className="lumen-error">{error}</p> : null}
        <button className="lumen-btn" type="submit" disabled={submitting}>
          {submitting ? 'creating…' : 'create account'}
        </button>
      </form>

      <p className="lumen-auth-switch">
        already in? <Link to="/login">sign in</Link>
      </p>
    </section>
  )
}
