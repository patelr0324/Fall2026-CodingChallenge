import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type FriendUser = {
  id: string
  username: string
}

type SearchUser = FriendUser & {
  relation: 'none' | 'friends' | 'outgoing' | 'incoming'
}

type IncomingRequest = {
  id: string
  from: FriendUser
}

type OutgoingRequest = {
  id: string
  to: FriendUser
}

type FriendBoard = {
  id: string
  title: string
  shareSlug: string | null
  ownerUsername: string
}

export function FriendsPage() {
  const { user, loading: authLoading } = useAuth()
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
  const [boards, setBoards] = useState<FriendBoard[]>([])
  const [loading, setLoading] = useState(true)

  const [draft, setDraft] = useState('')
  const [results, setResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [friendsData, requestsData, feedData] = await Promise.all([
        api<{ friends: FriendUser[] }>('/api/friends'),
        api<{
          incoming: IncomingRequest[]
          outgoing: OutgoingRequest[]
        }>('/api/friends/requests'),
        api<{ boards: FriendBoard[] }>('/api/friends/feed'),
      ])
      setFriends(friendsData.friends)
      setIncoming(requestsData.incoming)
      setOutgoing(requestsData.outgoing)
      setBoards(feedData.boards)
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'could not load friends',
      })
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

  async function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = draft.trim().toLowerCase()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const data = await api<{ users: SearchUser[] }>(
        `/api/friends/search?q=${encodeURIComponent(q)}`,
      )
      setResults(data.users)
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'search failed',
      })
    } finally {
      setSearching(false)
    }
  }

  async function sendRequest(username: string) {
    setBusyKey(`req:${username}`)
    try {
      const data = await api<{
        friendship: { status: string; user: FriendUser }
      }>('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username }),
      })
      if (data.friendship.status === 'accepted') {
        notifications.show({ color: 'teal', message: `now friends with @${username}` })
      } else {
        notifications.show({ color: 'teal', message: `request sent to @${username}` })
      }
      setResults((prev) =>
        prev.map((u) =>
          u.username === username
            ? {
                ...u,
                relation:
                  data.friendship.status === 'accepted' ? 'friends' : 'outgoing',
              }
            : u,
        ),
      )
      await load()
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'request failed',
      })
    } finally {
      setBusyKey(null)
    }
  }

  async function acceptRequest(requestId: string) {
    setBusyKey(`accept:${requestId}`)
    try {
      await api(`/api/friends/requests/${requestId}/accept`, { method: 'POST' })
      notifications.show({ color: 'teal', message: 'friend request accepted' })
      await load()
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'accept failed',
      })
    } finally {
      setBusyKey(null)
    }
  }

  async function rejectRequest(requestId: string) {
    setBusyKey(`reject:${requestId}`)
    try {
      await api(`/api/friends/requests/${requestId}/reject`, { method: 'POST' })
      setIncoming((prev) => prev.filter((r) => r.id !== requestId))
      notifications.show({ color: 'teal', message: 'request declined' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'reject failed',
      })
    } finally {
      setBusyKey(null)
    }
  }

  async function cancelRequest(requestId: string, username: string) {
    setBusyKey(`cancel:${requestId}`)
    try {
      await api(`/api/friends/requests/${requestId}/cancel`, { method: 'POST' })
      setOutgoing((prev) => prev.filter((r) => r.id !== requestId))
      setResults((prev) =>
        prev.map((u) =>
          u.username === username ? { ...u, relation: 'none' } : u,
        ),
      )
      notifications.show({ color: 'teal', message: 'request cancelled' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'cancel failed',
      })
    } finally {
      setBusyKey(null)
    }
  }

  async function unfriend(friendId: string, username: string) {
    if (!window.confirm(`unfriend @${username}?`)) return
    setBusyKey(`unfriend:${friendId}`)
    try {
      await api(`/api/friends/${friendId}`, { method: 'DELETE' })
      setFriends((prev) => prev.filter((f) => f.id !== friendId))
      setBoards((prev) => prev.filter((b) => b.ownerUsername !== username))
      notifications.show({ color: 'teal', message: `unfriended @${username}` })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'unfriend failed',
      })
    } finally {
      setBusyKey(null)
    }
  }

  if (authLoading) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / friends</p>
        <p className="lumen-page-blurb">loading…</p>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / friends</p>
        <h1 className="lumen-page-title">
          <span>stay</span>
          social
        </h1>
        <p className="lumen-page-blurb">
          <Link to="/login">sign in</Link> to find friends and see their public
          boards.
        </p>
      </section>
    )
  }

  return (
    <section className="lumen-page lumen-page-wide">
      <p className="lumen-page-kicker">lumen / friends</p>
      <h1 className="lumen-page-title">
        <span>stay</span>
        social
      </h1>
      <p className="lumen-page-blurb">
        search users, accept requests, and browse friends&apos; public boards.
      </p>

      <form className="lumen-discover-search" onSubmit={onSearch}>
        <label className="lumen-field lumen-discover-field">
          <span>find people</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="username…"
            autoComplete="off"
          />
        </label>
        <button className="lumen-btn lumen-btn-sm" type="submit" disabled={searching}>
          {searching ? 'searching…' : 'search'}
        </button>
      </form>

      {results.length > 0 ? (
        <div className="lumen-friends-section">
          <p className="lumen-settings-label">results</p>
          <ul className="lumen-friends-list">
            {results.map((u) => (
              <li key={u.id} className="lumen-friends-row">
                <span>@{u.username}</span>
                {u.relation === 'none' ? (
                  <button
                    type="button"
                    className="lumen-btn lumen-btn-sm"
                    disabled={busyKey === `req:${u.username}`}
                    onClick={() => void sendRequest(u.username)}
                  >
                    add
                  </button>
                ) : (
                  <span className="lumen-friends-status">{u.relation}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <p className="lumen-page-blurb">loading friends…</p>
      ) : (
        <>
          <div className="lumen-friends-section">
            <p className="lumen-settings-label">
              incoming {incoming.length > 0 ? `(${incoming.length})` : ''}
            </p>
            {incoming.length === 0 ? (
              <p className="lumen-modal-hint">no pending requests.</p>
            ) : (
              <ul className="lumen-friends-list">
                {incoming.map((r) => (
                  <li key={r.id} className="lumen-friends-row">
                    <span>@{r.from.username}</span>
                    <div className="lumen-friends-actions">
                      <button
                        type="button"
                        className="lumen-btn lumen-btn-sm"
                        disabled={busyKey === `accept:${r.id}`}
                        onClick={() => void acceptRequest(r.id)}
                      >
                        accept
                      </button>
                      <button
                        type="button"
                        className="lumen-btn lumen-btn-sm lumen-btn-danger-outline"
                        disabled={busyKey === `reject:${r.id}`}
                        onClick={() => void rejectRequest(r.id)}
                      >
                        decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lumen-friends-section">
            <p className="lumen-settings-label">
              outgoing {outgoing.length > 0 ? `(${outgoing.length})` : ''}
            </p>
            {outgoing.length === 0 ? (
              <p className="lumen-modal-hint">no sent requests.</p>
            ) : (
              <ul className="lumen-friends-list">
                {outgoing.map((r) => (
                  <li key={r.id} className="lumen-friends-row">
                    <span>@{r.to.username}</span>
                    <button
                      type="button"
                      className="lumen-btn lumen-btn-sm lumen-btn-danger-outline"
                      disabled={busyKey === `cancel:${r.id}`}
                      onClick={() => void cancelRequest(r.id, r.to.username)}
                    >
                      cancel
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lumen-friends-section">
            <p className="lumen-settings-label">
              friends {friends.length > 0 ? `(${friends.length})` : ''}
            </p>
            {friends.length === 0 ? (
              <p className="lumen-modal-hint">
                no friends yet — search a username above.
              </p>
            ) : (
              <ul className="lumen-friends-list">
                {friends.map((f) => (
                  <li key={f.id} className="lumen-friends-row">
                    <span>@{f.username}</span>
                    <button
                      type="button"
                      className="lumen-btn lumen-btn-sm lumen-btn-danger-outline"
                      disabled={busyKey === `unfriend:${f.id}`}
                      onClick={() => void unfriend(f.id, f.username)}
                    >
                      unfriend
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lumen-friends-section">
            <p className="lumen-settings-label">friends&apos; public boards</p>
            {boards.length === 0 ? (
              <p className="lumen-modal-hint">
                when friends share a board publicly, it shows up here.
              </p>
            ) : (
              <div className="lumen-board-grid">
                {boards.map((board) => (
                  <Link
                    key={board.id}
                    to={
                      board.shareSlug
                        ? `/b/${board.shareSlug}`
                        : '/collections'
                    }
                    className="lumen-board-card"
                  >
                    <p className="lumen-board-kicker">
                      @{board.ownerUsername} · public
                    </p>
                    <h2 className="lumen-board-title">{board.title}</h2>
                    <p className="lumen-board-meta">open board →</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
