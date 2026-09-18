import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  CollectionPickerModal,
  type BoardOption,
} from '../components/CollectionPickerModal'
import { DiscoverSearchBar } from '../components/DiscoverSearchBar'
import { ImageCard, type DiscoverImage } from '../components/ImageCard'
import { MasonryGrid } from '../components/MasonryGrid'

const PER_PAGE = 24

type DiscoverResponse = {
  images: DiscoverImage[]
  totalHits: number
  page: number
  hasMore: boolean
}

export function DiscoverPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [color, setColor] = useState('')
  const [images, setImages] = useState<DiscoverImage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set())

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerImage, setPickerImage] = useState<DiscoverImage | null>(null)
  const [collections, setCollections] = useState<BoardOption[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(false)
  const loadingRef = useRef(true)
  const loadingMoreRef = useRef(false)
  const queryRef = useRef(query)
  const colorRef = useRef(color)

  queryRef.current = query
  colorRef.current = color
  hasMoreRef.current = hasMore
  loadingRef.current = loading

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
        if (loadingMoreRef.current || !hasMoreRef.current) return
        setLoadingMore(true)
        loadingMoreRef.current = true
      } else {
        setLoading(true)
        loadingRef.current = true
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
        pageRef.current = pageNum
        setHasMore(data.hasMore)
        hasMoreRef.current = data.hasMore
      } catch (err) {
        if (!append) {
          setImages([])
          setHasMore(false)
          hasMoreRef.current = false
        }
        setError(err instanceof Error ? err.message : 'could not load images')
      } finally {
        setLoading(false)
        loadingRef.current = false
        setLoadingMore(false)
        loadingMoreRef.current = false
      }
    },
    [buildUrl],
  )

  useEffect(() => {
    pageRef.current = 1
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
          !hasMoreRef.current ||
          loadingRef.current ||
          loadingMoreRef.current
        ) {
          return
        }
        void loadPage(
          queryRef.current,
          colorRef.current,
          pageRef.current + 1,
          true,
        )
      },
      { rootMargin: '240px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [loadPage])

  const onSearch = useCallback((nextQuery: string) => {
    setQuery(nextQuery)
  }, [])

  const onColorChange = useCallback((nextColor: string) => {
    setColor(nextColor)
  }, [])

  const saveToLibrary = useCallback(
    async (image: DiscoverImage) => {
      if (!user) {
        notifications.show({
          color: 'coral',
          message: 'sign in to save images',
        })
        return
      }

      let alreadySaved = false
      setSavedIds((prev) => {
        if (prev.has(image.pixabayId)) {
          alreadySaved = true
          return prev
        }
        return new Set(prev).add(image.pixabayId)
      })
      if (alreadySaved) return

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
        setSavedIds((prev) => {
          const next = new Set(prev)
          next.delete(image.pixabayId)
          return next
        })
        notifications.show({
          color: 'red',
          message: err instanceof Error ? err.message : 'save failed',
        })
      } finally {
        setBusyId(null)
      }
    },
    [user],
  )

  const openBoardPicker = useCallback(
    async (image: DiscoverImage) => {
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
        const data = await api<{ collections: BoardOption[] }>(
          '/api/collections',
        )
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
    },
    [user],
  )

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
        message: createdTitle
          ? 'board created and image saved'
          : 'added to board',
      })
      setSavedIds((prev) => new Set(prev).add(pickerImage.pixabayId))
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

      <DiscoverSearchBar
        color={color}
        loading={loading && images.length === 0}
        onSearch={onSearch}
        onColorChange={onColorChange}
      />

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
            saved={savedIds.has(image.pixabayId)}
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
