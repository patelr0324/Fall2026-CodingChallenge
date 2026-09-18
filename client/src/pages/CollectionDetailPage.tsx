import { useCallback, useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  CollectionPickerModal,
  type BoardOption,
} from '../components/CollectionPickerModal'
import { ImageCard, type DiscoverImage } from '../components/ImageCard'
import { MasonryGrid } from '../components/MasonryGrid'
import type { CollectionSummary } from './CollectionsPage'

type CollectionItem = {
  itemId: string
  order: number
  savedImage: {
    id: string
    pixabayId: string
    imageUrl: string
    previewUrl: string
    tags: string
  }
}

type Collaborator = {
  id: string
  username: string
}

/** board detail: masonry items, share/visibility, collaborators, move/remove */
export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [collection, setCollection] = useState<CollectionSummary | null>(null)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [sharingBusy, setSharingBusy] = useState(false)
  const [collabOpen, setCollabOpen] = useState(false)

  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTargets, setMoveTargets] = useState<BoardOption[]>([])
  const [moveToId, setMoveToId] = useState('')
  const [moveNewTitle, setMoveNewTitle] = useState('')
  const [moveImageId, setMoveImageId] = useState<string | null>(null)
  const [movePixabayId, setMovePixabayId] = useState<string | null>(null)
  const [moveLoading, setMoveLoading] = useState(false)

  const isOwner = !!(user && collection && collection.ownerId === user.id)
  const isLibrary = !!collection?.isLibrary
  const canEdit = !!(user && collection && (isOwner || collection.collaboratorIds.includes(user.id)))
  const hasContentRef = useRef(false)

  const shareUrl =
    collection?.shareSlug && typeof window !== 'undefined'
      ? `${window.location.origin}/b/${collection.shareSlug}`
      : null

  const load = useCallback(async () => {
    if (!id) return
    if (!hasContentRef.current) setLoading(true)
    setError(null)
    try {
      const data = await api<{
        collection: CollectionSummary
        items: CollectionItem[]
        collaborators?: Collaborator[]
      }>(`/api/collections/${id}`)
      setCollection(data.collection)
      setItems(data.items)
      setCollaborators(data.collaborators ?? [])
      setTitleDraft(data.collection.title)
      hasContentRef.current = true
    } catch (err) {
      setCollection(null)
      setItems([])
      setCollaborators([])
      hasContentRef.current = false
      setError(err instanceof Error ? err.message : 'could not load board')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    hasContentRef.current = false
    setCollection(null)
    setItems([])
  }, [id])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void load()
  }, [user, load])

  async function onRename(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!id || !collection || isLibrary) return
    const next = titleDraft.trim()
    if (!next) return
    setSavingMeta(true)
    try {
      const data = await api<{ collection: CollectionSummary }>(
        `/api/collections/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title: next }),
        },
      )
      setCollection(data.collection)
      setEditing(false)
      notifications.show({ color: 'teal', message: 'board renamed' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'rename failed',
      })
    } finally {
      setSavingMeta(false)
    }
  }

  async function onDeleteBoard() {
    if (!id || !collection || isLibrary) return
    if (!window.confirm(`delete “${collection.title}”? this cannot be undone.`)) {
      return
    }
    try {
      await api(`/api/collections/${id}`, { method: 'DELETE' })
      notifications.show({ color: 'teal', message: 'board deleted' })
      navigate('/collections')
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'delete failed',
      })
    }
  }

  async function onShare() {
    if (!id) return
    setSharingBusy(true)
    const prev = collection
    setCollection((c) =>
      c ? { ...c, visibility: 'public' } : c,
    )
    try {
      const data = await api<{
        collection: CollectionSummary
        sharePath: string
      }>(`/api/collections/${id}/share`, { method: 'POST' })
      setCollection(data.collection)
      const url = `${window.location.origin}${data.sharePath}`
      try {
        await navigator.clipboard.writeText(url)
        notifications.show({ color: 'teal', message: 'public · link copied' })
      } catch {
        notifications.show({ color: 'teal', message: `public · ${url}` })
      }
    } catch (err) {
      if (prev) setCollection(prev)
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'share failed',
      })
    } finally {
      setSharingBusy(false)
    }
  }

  async function onUnshare() {
    if (!id) return
    setSharingBusy(true)
    const prev = collection
    setCollection((c) =>
      c ? { ...c, visibility: 'private' } : c,
    )
    try {
      const data = await api<{ collection: CollectionSummary }>(
        `/api/collections/${id}/unshare`,
        { method: 'POST' },
      )
      setCollection(data.collection)
      notifications.show({ color: 'teal', message: 'board is private' })
    } catch (err) {
      if (prev) setCollection(prev)
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'unshare failed',
      })
    } finally {
      setSharingBusy(false)
    }
  }

  async function onVisibilityChange(next: 'private' | 'public') {
    if (!collection || sharingBusy) return
    if (next === collection.visibility) return
    if (next === 'public') await onShare()
    else await onUnshare()
  }

  async function onCopyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      notifications.show({ color: 'teal', message: 'link copied' })
    } catch {
      notifications.show({ color: 'red', message: 'could not copy link' })
    }
  }

  async function onInvite(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!id) return
    const username = inviteUsername.trim().toLowerCase()
    if (!username) return
    setSharingBusy(true)
    try {
      const data = await api<{
        collection: CollectionSummary
        collaborators: Collaborator[]
      }>(`/api/collections/${id}/collaborators`, {
        method: 'POST',
        body: JSON.stringify({ username }),
      })
      setCollection(data.collection)
      setCollaborators(data.collaborators)
      setInviteUsername('')
      notifications.show({ color: 'teal', message: `invited @${username}` })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'invite failed',
      })
    } finally {
      setSharingBusy(false)
    }
  }

  async function onRemoveCollaborator(userId: string) {
    if (!id) return
    setSharingBusy(true)
    try {
      const data = await api<{
        collection: CollectionSummary
        collaborators: Collaborator[]
      }>(`/api/collections/${id}/collaborators/${userId}`, {
        method: 'DELETE',
      })
      setCollection(data.collection)
      setCollaborators(data.collaborators)
      notifications.show({ color: 'teal', message: 'collaborator removed' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'remove failed',
      })
    } finally {
      setSharingBusy(false)
    }
  }

  async function onRemove(image: DiscoverImage & { savedImageId?: string }) {
    if (!id || !image.savedImageId) return
    const savedImageId = image.savedImageId
    const snapshot = items
    setBusyId(image.pixabayId)
    setItems((prev) =>
      prev.filter((item) => item.savedImage.id !== savedImageId),
    )
    try {
      await api(`/api/collections/${id}/items/${savedImageId}`, {
        method: 'DELETE',
      })
      notifications.show({ color: 'teal', message: 'removed from board' })
    } catch (err) {
      setItems(snapshot)
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'remove failed',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function openMovePicker(
    image: DiscoverImage & { savedImageId?: string },
  ) {
    if (!id || !image.savedImageId) return
    setMoveImageId(image.savedImageId)
    setMovePixabayId(image.pixabayId)
    setMoveOpen(true)
    setMoveLoading(true)
    setMoveNewTitle('')
    try {
      const data = await api<{ collections: CollectionSummary[] }>(
        '/api/collections',
      )
      const targets = data.collections.filter((c) => c.id !== id)
      setMoveTargets(targets)
      setMoveToId(targets[0]?.id ?? '')
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'could not load boards',
      })
      setMoveOpen(false)
    } finally {
      setMoveLoading(false)
    }
  }

  async function confirmMove() {
    if (!id || !moveImageId) return
    const movingId = moveImageId
    const snapshot = items
    setBusyId(movePixabayId)
    setItems((prev) =>
      prev.filter((item) => item.savedImage.id !== movingId),
    )
    setMoveOpen(false)

    try {
      let toCollectionId = moveToId
      const createdTitle = moveNewTitle.trim()

      if (createdTitle) {
        const created = await api<{ collection: BoardOption }>(
          '/api/collections',
          {
            method: 'POST',
            body: JSON.stringify({ title: createdTitle }),
          },
        )
        toCollectionId = created.collection.id
      }

      if (!toCollectionId) {
        throw new Error('pick a board or name a new one')
      }

      await api(`/api/collections/${id}/items/${movingId}/move`, {
        method: 'POST',
        body: JSON.stringify({ toCollectionId }),
      })
      notifications.show({
        color: 'teal',
        message: createdTitle ? 'board created and image moved' : 'moved to board',
      })
      setMoveImageId(null)
      setMovePixabayId(null)
      setMoveNewTitle('')
    } catch (err) {
      setItems(snapshot)
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'move failed',
      })
    } finally {
      setBusyId(null)
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
        <p className="lumen-page-blurb">
          <Link to="/login">sign in</Link> to view this board.
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / collections</p>
        <p className="lumen-page-blurb">loading board…</p>
      </section>
    )
  }

  if (error || !collection) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / collections</p>
        <h1 className="lumen-page-title">
          <span>board</span>
          missing
        </h1>
        <p className="lumen-error">{error || 'not found'}</p>
        <Link to="/collections" className="lumen-btn lumen-btn-ghost">
          back to boards
        </Link>
      </section>
    )
  }

  return (
    <section className="lumen-page lumen-page-wide">
      <p className="lumen-page-kicker">
        <Link to="/collections" className="lumen-inline-link">
          collections
        </Link>
        {' / '}
        {isLibrary ? 'library' : collection.visibility}
      </p>

      {editing && isOwner && !isLibrary ? (
        <form className="lumen-discover-search" onSubmit={onRename}>
          <label className="lumen-field lumen-discover-field">
            <span>rename board</span>
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              maxLength={80}
              required
              autoFocus
            />
          </label>
          <button className="lumen-btn" type="submit" disabled={savingMeta}>
            {savingMeta ? 'saving…' : 'save'}
          </button>
          <button
            type="button"
            className="lumen-btn lumen-btn-ghost-inline"
            onClick={() => {
              setEditing(false)
              setTitleDraft(collection.title)
            }}
          >
            cancel
          </button>
        </form>
      ) : (
        <div className="lumen-board-intro">
          <h1 className="lumen-page-title">
            {isLibrary ? (
              <>
                <span>your</span>
                library
              </>
            ) : (
              (() => {
                const words = collection.title.trim().split(/\s+/).filter(Boolean)
                if (words.length <= 1) return words[0] ?? 'board'
                return (
                  <>
                    <span>{words[0]}</span>
                    {words.slice(1).join(' ')}
                  </>
                )
              })()
            )}
          </h1>

          <p className="lumen-page-blurb">
            {items.length} {items.length === 1 ? 'image' : 'images'}
            {isLibrary
              ? ' · quick saves land here — move them to other boards anytime'
              : null}
            {!isOwner && canEdit ? ' · you can edit this shared board' : null}
            {' · '}
            add more from <Link to="/discover">discover</Link>
          </p>

          {isOwner && !isLibrary ? (
            <div className="lumen-board-toolbar">
              <button
                type="button"
                className="lumen-btn lumen-btn-sm"
                onClick={() => setEditing(true)}
              >
                rename
              </button>

              <div
                className="lumen-visibility"
                role="group"
                aria-label="visibility"
              >
                <button
                  type="button"
                  className="lumen-visibility-btn"
                  data-active={
                    collection.visibility === 'private' ? 'true' : 'false'
                  }
                  disabled={sharingBusy}
                  onClick={() => void onVisibilityChange('private')}
                >
                  private
                </button>
                <button
                  type="button"
                  className="lumen-visibility-btn"
                  data-active={
                    collection.visibility === 'public' ? 'true' : 'false'
                  }
                  disabled={sharingBusy}
                  onClick={() => void onVisibilityChange('public')}
                >
                  public
                </button>
              </div>

              {collection.visibility === 'public' ? (
                <button
                  type="button"
                  className="lumen-btn lumen-btn-sm"
                  onClick={() => void onCopyLink()}
                  disabled={!shareUrl}
                >
                  copy link
                </button>
              ) : null}

              <button
                type="button"
                className="lumen-btn lumen-btn-sm"
                onClick={() => setCollabOpen(true)}
              >
                collaborators
                {collaborators.length > 0 ? ` (${collaborators.length})` : ''}
              </button>
              <button
                type="button"
                className="lumen-btn lumen-btn-sm lumen-btn-danger-outline"
                onClick={() => void onDeleteBoard()}
              >
                delete
              </button>
            </div>
          ) : null}
        </div>
      )}

      {items.length === 0 ? (
        <p className="lumen-page-blurb">
          {isLibrary
            ? 'library is empty — hit save on discover.'
            : 'this board is empty — save images to it from discover, or move from library.'}
        </p>
      ) : (
        <MasonryGrid>
          {items.map((item) => {
            const image: DiscoverImage & { savedImageId: string } = {
              pixabayId: item.savedImage.pixabayId,
              imageUrl: item.savedImage.imageUrl,
              previewUrl: item.savedImage.previewUrl,
              tags: item.savedImage.tags,
              savedImageId: item.savedImage.id,
            }
            return (
              <ImageCard
                key={item.itemId}
                image={image}
                saving={busyId === image.pixabayId}
                onMove={
                  canEdit
                    ? (img) =>
                        void openMovePicker({
                          ...img,
                          savedImageId: item.savedImage.id,
                        })
                    : undefined
                }
                onRemove={
                  canEdit
                    ? (img) =>
                        void onRemove({
                          ...img,
                          savedImageId: item.savedImage.id,
                        })
                    : undefined
                }
              />
            )
          })}
        </MasonryGrid>
      )}

      {moveOpen ? (
        <CollectionPickerModal
          title="move to board"
          collections={moveTargets}
          selectedId={moveToId}
          onSelect={setMoveToId}
          loading={moveLoading}
          confirming={!!busyId}
          allowCreate
          newTitle={moveNewTitle}
          onNewTitleChange={setMoveNewTitle}
          confirmLabel="move"
          onConfirm={() => void confirmMove()}
          onClose={() => setMoveOpen(false)}
        />
      ) : null}

      {collabOpen ? (
        <div
          className="lumen-modal-backdrop"
          role="presentation"
          onClick={() => setCollabOpen(false)}
        >
          <div
            className="lumen-modal"
            role="dialog"
            aria-modal="true"
            aria-label="collaborators"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="lumen-page-kicker">collaborators</p>
            <p className="lumen-modal-hint">
              they can add, move, and remove images on this board.
            </p>

            <form className="lumen-collab-invite" onSubmit={onInvite}>
              <label className="lumen-field">
                <span>invite by username</span>
                <input
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="username"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <button
                className="lumen-btn lumen-btn-sm"
                type="submit"
                disabled={sharingBusy || !inviteUsername.trim()}
              >
                invite
              </button>
            </form>

            {collaborators.length > 0 ? (
              <ul className="lumen-collab-list">
                {collaborators.map((c) => (
                  <li key={c.id} className="lumen-collab-row">
                    <span>@{c.username}</span>
                    <button
                      type="button"
                      className="lumen-pin-btn lumen-pin-btn-danger"
                      disabled={sharingBusy}
                      onClick={() => void onRemoveCollaborator(c.id)}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lumen-modal-hint">no collaborators yet.</p>
            )}

            <div className="lumen-modal-actions">
              <button
                type="button"
                className="lumen-btn lumen-btn-sm lumen-btn-ghost-inline"
                onClick={() => setCollabOpen(false)}
              >
                done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
