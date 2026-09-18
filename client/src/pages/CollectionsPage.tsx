import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export type CollectionSummary = {
  id: string
  ownerId: string
  title: string
  visibility: 'private' | 'public'
  isLibrary: boolean
  shareSlug: string | null
  collaboratorIds: string[]
}

export function CollectionsPage() {
  const { user, loading: authLoading } = useAuth()
  const [collections, setCollections] = useState<CollectionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<{ collections: CollectionSummary[] }>(
        '/api/collections',
      )
      setCollections(data.collections)
    } catch (err) {
      setCollections([])
      setError(err instanceof Error ? err.message : 'could not load boards')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void load()
  }, [user, load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const next = title.trim()
    if (!next) return
    setCreating(true)
    try {
      const data = await api<{ collection: CollectionSummary }>(
        '/api/collections',
        {
          method: 'POST',
          body: JSON.stringify({ title: next }),
        },
      )
      setCollections((prev) => [data.collection, ...prev])
      setTitle('')
      notifications.show({ color: 'teal', message: 'board created' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'could not create board',
      })
    } finally {
      setCreating(false)
    }
  }

  if (authLoading) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / collections</p>
        <p className="lumen-page-blurb">loading…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / collections</p>
        <h1 className="lumen-page-title">
          <span>your</span>
          boards
        </h1>
        <p className="lumen-page-blurb">
          <Link to="/login">sign in</Link> to create and view collections.
        </p>
      </section>
    )
  }

  return (
    <section className="lumen-page lumen-page-wide">
      <p className="lumen-page-kicker">lumen / collections</p>
      <h1 className="lumen-page-title">
        <span>your</span>
        boards
      </h1>

      <form className="lumen-discover-search" onSubmit={onCreate}>
        <label className="lumen-field lumen-discover-field">
          <span>new board</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="moodboard, references…"
            maxLength={80}
            required
          />
        </label>
        <button className="lumen-btn" type="submit" disabled={creating}>
          {creating ? 'creating…' : 'create'}
        </button>
      </form>

      {error ? <p className="lumen-error">{error}</p> : null}
      {loading ? <p className="lumen-page-blurb">loading boards…</p> : null}

      {!loading && collections.length === 0 ? (
        <p className="lumen-page-blurb">no boards yet — create one above.</p>
      ) : null}

      <div className="lumen-board-grid">
        {collections.map((board) => (
          <Link
            key={board.id}
            to={`/collections/${board.id}`}
            className="lumen-board-card"
            data-library={board.isLibrary ? 'true' : 'false'}
          >
            <p className="lumen-board-kicker">
              {board.isLibrary ? 'system · library' : board.visibility}
            </p>
            <h2 className="lumen-board-title">{board.title}</h2>
            <p className="lumen-board-meta">
              {board.isLibrary ? 'open library →' : 'open board →'}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
