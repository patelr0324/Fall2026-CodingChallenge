import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ColorFilterDropdown } from '../components/ColorFilterDropdown'
import {
  CollectionPickerModal,
  type BoardOption,
} from '../components/CollectionPickerModal'
import { ImageCard, type DiscoverImage } from '../components/ImageCard'
import { MasonryGrid } from '../components/MasonryGrid'

const PER_PAGE = 40

type DiscoverResponse = {
  images: DiscoverImage[]
  totalHits: number
  page: number
  hasMore: boolean
}

export function DiscoverPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState('')
  const [images, setImages] = useState<DiscoverImage[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerImage, setPickerImage] = useState<DiscoverImage | null>(null)
  const [collections, setCollections] = useState<BoardOption[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)

  const buildUrl = useCallback(
    (q: string, pageNum: number, colorFilter: string) => {
      const params = new URLSearchParams({
        page: String(pageNum),
        perPage: String(PER_PAGE),
      })
      if (q) params.set('q', q)
      if (colorFilter) params.set('colors', colorFilter)
      return `/api/images/discover?${params.toString()}`
    },
    [],
  )

  const loadPage = useCallback(
    async (q: string, colorFilter: string, pageNum: number, append: boolean) => {
      if (append) {
        setLoadingMore(true)
        loadingMoreRef.current = true
      } else {
        setLoading(true)
        setError(null)
      }

      try {
        const data = await api<DiscoverResponse>(
          buildUrl(q, pageNum, colorFilter),
        )
        setImages((prev) => {
          if (!append) return data.images
          const seen = new Set(prev.map((img) => img.pixabayId))
          return [
            ...prev,
            ...data.images.filter((img) => !seen.has(img.pixabayId)),
          ]
        })
        setPage(pageNum)
        setHasMore(data.hasMore)
      } catch (err) {
        if (!append) {
          setImages([])
          setHasMore(false)
        }
        setError(err instanceof Error ? err.message : 'could not load images')
      } finally {
        setLoading(false)
        setLoadingMore(false)
        loadingMoreRef.current = false
      }
    },
    [buildUrl],
  )

  useEffect(() => {
    void loadPage(query, color, 1, false)
  }, [loadPage, query, color])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (
          !entry?.isIntersecting ||
          !hasMore ||
          loading ||
          loadingMoreRef.current
        ) {
          return
        }
        void loadPage(query, color, page + 1, true)
      },
      { rootMargin: '400px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loading, loadPage, query, color, page])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    setQuery(draft.trim())
  }

  async function saveToLibrary(image: DiscoverImage) {
    if (!user) {
      notifications.show({
        color: 'coral',
        message: 'sign in to save images',
      })
      return
    }
    setBusyId(image.pixabayId)
    try {
      await api('/api/collections/library/items', {
        method: 'POST',
        body: JSON.stringify({
          pixabayId: image.pixabayId,
          imageUrl: image.imageUrl,
          previewUrl: image.previewUrl,
          tags: image.tags,
        }),
      })
      notifications.show({ color: 'teal', message: 'saved to library' })
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'save failed',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function openBoardPicker(image: DiscoverImage) {
    if (!user) {
      notifications.show({
        color: 'coral',
        message: 'sign in to save to a board',
      })
      return
    }
    setPickerImage(image)
    setPickerOpen(true)
    setPickerLoading(true)
    setNewBoardTitle('')
    try {
      const data = await api<{ collections: BoardOption[] }>('/api/collections')
      // prefer non-library boards for “to board”, but keep library available
      const boards = data.collections
      setCollections(boards)
      const preferred =
        boards.find((c) => !c.isLibrary)?.id ?? boards[0]?.id ?? ''
      setSelectedCollectionId(preferred)
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'could not load boards',
      })
      setPickerOpen(false)
    } finally {
      setPickerLoading(false)
    }
  }

  async function confirmSaveToBoard() {
    if (!pickerImage) return
    setBusyId(pickerImage.pixabayId)
    try {
      let collectionId = selectedCollectionId
      const createdTitle = newBoardTitle.trim()

      if (createdTitle) {
        const created = await api<{ collection: BoardOption }>(
          '/api/collections',
          {
            method: 'POST',
            body: JSON.stringify({ title: createdTitle }),
          },
        )
        collectionId = created.collection.id
      }

      if (!collectionId) {
        throw new Error('pick a board or name a new one')
      }

      await api(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          pixabayId: pickerImage.pixabayId,
          imageUrl: pickerImage.imageUrl,
          previewUrl: pickerImage.previewUrl,
          tags: pickerImage.tags,
        }),
      })

      notifications.show({
        color: 'teal',
        message: createdTitle ? 'board created and image saved' : 'added to board',
      })
      setPickerOpen(false)
      setPickerImage(null)
      setNewBoardTitle('')
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'could not add to board',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="lumen-page lumen-page-wide">
      <p className="lumen-page-kicker">lumen / discover</p>
      <h1 className="lumen-page-title">
        <span>find</span>
        images
      </h1>
      <p className="lumen-page-blurb">
        browse pixabay, then save to your{' '}
        <Link to="/collections">collections</Link>
        {!user ? (
          <>
            {' '}
            <Link to="/login">sign in</Link> to save.
          </>
        ) : null}
      </p>

      <form className="lumen-discover-search" onSubmit={onSearch}>
        <label className="lumen-field lumen-discover-field">
          <span>search</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="leave blank for editors’ picks"
          />
        </label>
        <ColorFilterDropdown value={color} onChange={setColor} />
        <button className="lumen-btn lumen-btn-sm" type="submit" disabled={loading}>
          {loading ? 'loading…' : 'search'}
        </button>
      </form>

      {error ? <p className="lumen-error">{error}</p> : null}

      {!loading && !error && images.length === 0 ? (
        <p className="lumen-page-blurb">no images for that search.</p>
      ) : null}

      <MasonryGrid>
        {images.map((image) => (
          <ImageCard
            key={image.pixabayId}
            image={image}
            saving={busyId === image.pixabayId}
            onSave={saveToLibrary}
            onSaveToCollection={openBoardPicker}
          />
        ))}
      </MasonryGrid>

      <div ref={sentinelRef} className="lumen-scroll-sentinel" aria-hidden />
      {loadingMore ? (
        <p className="lumen-scroll-status">loading more…</p>
      ) : null}
      {!loading && !hasMore && images.length > 0 ? (
        <p className="lumen-scroll-status">end of results</p>
      ) : null}

      {pickerOpen ? (
        <CollectionPickerModal
          title="save to board"
          collections={collections}
          selectedId={selectedCollectionId}
          onSelect={setSelectedCollectionId}
          loading={pickerLoading}
          confirming={!!busyId}
          allowCreate
          newTitle={newBoardTitle}
          onNewTitleChange={setNewBoardTitle}
          confirmLabel="save"
          onConfirm={() => void confirmSaveToBoard()}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </section>
  )
}
