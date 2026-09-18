import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { ImageCard, type DiscoverImage } from '../components/ImageCard'
import { MasonryGrid } from '../components/MasonryGrid'

type PublicBoard = {
  id: string
  title: string
  visibility: string
  shareSlug: string | null
  ownerUsername: string
}

type PublicItem = {
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

export function PublicBoardPage() {
  const { shareSlug } = useParams<{ shareSlug: string }>()
  const [board, setBoard] = useState<PublicBoard | null>(null)
  const [items, setItems] = useState<PublicItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shareSlug) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await api<{
          collection: PublicBoard
          items: PublicItem[]
        }>(`/api/public/boards/${encodeURIComponent(shareSlug!)}`)
        if (cancelled) return
        setBoard(data.collection)
        setItems(data.items)
      } catch (err) {
        if (cancelled) return
        setBoard(null)
        setItems([])
        setError(err instanceof Error ? err.message : 'board not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [shareSlug])

  if (loading) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / shared</p>
        <p className="lumen-page-blurb">loading board…</p>
      </section>
    )
  }

  if (error || !board) {
    return (
      <section className="lumen-page">
        <p className="lumen-page-kicker">lumen / shared</p>
        <h1 className="lumen-page-title">
          <span>link</span>
          expired
        </h1>
        <p className="lumen-error">{error || 'not found'}</p>
        <Link to="/discover" className="lumen-btn lumen-btn-ghost">
          go discover
        </Link>
      </section>
    )
  }

  const words = board.title.trim().split(/\s+/).filter(Boolean)

  return (
    <section className="lumen-page lumen-page-wide">
      <p className="lumen-page-kicker">
        shared board · by {board.ownerUsername}
      </p>
      <div className="lumen-board-intro">
        <h1 className="lumen-page-title">
          {words.length <= 1 ? (
            words[0] ?? 'board'
          ) : (
            <>
              <span>{words[0]}</span>
              {words.slice(1).join(' ')}
            </>
          )}
        </h1>
        <p className="lumen-page-blurb">
          {items.length} {items.length === 1 ? 'image' : 'images'} · public view
        </p>
      </div>

      {items.length === 0 ? (
        <p className="lumen-page-blurb">this shared board is empty.</p>
      ) : (
        <MasonryGrid>
          {items.map((item) => {
            const image: DiscoverImage = {
              pixabayId: item.savedImage.pixabayId,
              imageUrl: item.savedImage.imageUrl,
              previewUrl: item.savedImage.previewUrl,
              tags: item.savedImage.tags,
            }
            return <ImageCard key={item.itemId} image={image} />
          })}
        </MasonryGrid>
      )}
    </section>
  )
}
