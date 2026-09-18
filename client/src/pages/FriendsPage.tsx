import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
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

type ManageTab = 'find' | 'incoming' | 'outgoing'

/** friend requests + filterable feed of friends' public boards. */
export function FriendsPage() {
  const { user, loading: authLoading } = useAuth()
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
  const [boards, setBoards] = useState<FriendBoard[]>([])
  const [loading, setLoading] = useState(true)

  const [manageTab, setManageTab] = useState<ManageTab | null>(null)
  const [boardFilter, setBoardFilter] = useState<string | null>(null)

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

  const filteredBoards = boardFilter
    ? boards.filter((b) => b.ownerUsername === boardFilter)
    : boards

  async function onSearch(e: SubmitEvent<HTMLFormElement>) {
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
        setManageTab('outgoing')
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
      if (boardFilter === username) setBoardFilter(null)
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

  function toggleManageTab(tab: ManageTab) {
    setManageTab((prev) => (prev === tab ? null : tab))
  }

  function toggleBoardFilter(username: string) {
    setBoardFilter((prev) => (prev === username ? null : username))
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
        manage requests, then tap a friend to filter their public boards.
      </p>

      <div className="lumen-friends-menu">
        <p className="lumen-settings-label">manage</p>
        <div className="lumen-friends-tabs" role="tablist" aria-label="manage friends">
          <button
            type="button"
            role="tab"
            aria-selected={manageTab === 'find'}
            className={`lumen-friends-tab${manageTab === 'find' ? ' is-active' : ''}`}
            onClick={() => toggleManageTab('find')}
          >
            find
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={manageTab === 'incoming'}
            className={`lumen-friends-tab${manageTab === 'incoming' ? ' is-active' : ''}`}
            onClick={() => toggleManageTab('incoming')}
          >
            incoming
            {incoming.length > 0 ? ` (${incoming.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={manageTab === 'outgoing'}
            className={`lumen-friends-tab${manageTab === 'outgoing' ? ' is-active' : ''}`}
            onClick={() => toggleManageTab('outgoing')}
          >
            outgoing
            {outgoing.length > 0 ? ` (${outgoing.length})` : ''}
          </button>
        </div>

        {manageTab ? (
        <div className="lumen-friends-panel">
          {manageTab === 'find' ? (
            <>
              <form className="lumen-discover-search" onSubmit={onSearch}>
                <label className="lumen-field lumen-discover-field">
                  <span>username</span>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="username…"
                    autoComplete="off"
                  />
                </label>
                <button
                  className="lumen-btn lumen-btn-sm"
                  type="submit"
                  disabled={searching}
                >
                  {searching ? 'searching…' : 'search'}
                </button>
              </form>
              {results.length === 0 ? (
                <p className="lumen-modal-hint">search by username to send a request.</p>
              ) : (
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
              )}
            </>
          ) : null}

          {manageTab === 'incoming' ? (
            incoming.length === 0 ? (
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
            )
          ) : null}

          {manageTab === 'outgoing' ? (
            outgoing.length === 0 ? (
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
            )
          ) : null}
        </div>
        ) : null}
      </div>

      {loading ? (
        <p className="lumen-page-blurb">loading friends…</p>
      ) : (
        <>
          <div className="lumen-friends-section">
            <p className="lumen-settings-label">
              friends {friends.length > 0 ? `(${friends.length})` : ''}
            </p>
            {friends.length === 0 ? (
              <p className="lumen-modal-hint">
                no friends yet — open find above to search.
              </p>
            ) : (
              <ul className="lumen-friends-list">
                {friends.map((f) => {
                  const active = boardFilter === f.username
                  return (
                    <li
                      key={f.id}
                      className={`lumen-friends-row${active ? ' is-selected' : ''}`}
                    >
                      <button
                        type="button"
                        className="lumen-friends-name"
                        onClick={() => toggleBoardFilter(f.username)}
                        aria-pressed={active}
                        title={
                          active
                            ? 'show all boards'
                            : `show @${f.username}'s boards`
                        }
                      >
                        @{f.username}
                      </button>
                      <button
                        type="button"
                        className="lumen-btn lumen-btn-sm lumen-btn-danger-outline"
                        disabled={busyKey === `unfriend:${f.id}`}
                        onClick={() => void unfriend(f.id, f.username)}
                      >
                        unfriend
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="lumen-friends-section">
            <div className="lumen-friends-boards-head">
              <p className="lumen-settings-label">
                {boardFilter
                  ? `@${boardFilter}'s public boards`
                  : "friends' public boards"}
              </p>
              {boardFilter ? (
                <button
                  type="button"
                  className="lumen-friends-clear"
                  onClick={() => setBoardFilter(null)}
                >
                  show all
                </button>
              ) : null}
            </div>
            {filteredBoards.length === 0 ? (
              <p className="lumen-modal-hint">
                {boardFilter
                  ? `@${boardFilter} has no public boards yet.`
                  : 'when friends share a board publicly, it shows up here.'}
              </p>
            ) : (
              <div className="lumen-board-grid">
                {filteredBoards.map((board) => (
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
