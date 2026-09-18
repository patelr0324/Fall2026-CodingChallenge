import { memo } from 'react'

export type DiscoverImage = {
  pixabayId: string
  imageUrl: string
  previewUrl: string
  tags: string
  photographer?: string
  width?: number
  height?: number
}

type ImageCardProps = {
  image: DiscoverImage
  onSave?: (image: DiscoverImage) => void
  onSaveToCollection?: (image: DiscoverImage) => void
  onMove?: (image: DiscoverImage) => void
  onRemove?: (image: DiscoverImage) => void
  saving?: boolean
  saved?: boolean
}

/**  pin card — lazy-loads images; action buttons only when handlers are passed. */
export const ImageCard = memo(function ImageCard({
  image,
  onSave,
  onSaveToCollection,
  onMove,
  onRemove,
  saving = false,
  saved = false,
}: ImageCardProps) {
  const label = image.tags.split(',')[0]?.trim() || 'untitled'
  const ratio =
    image.width && image.height && image.height > 0
      ? image.width / image.height
      : 0.75

  const hasActions = !!(onSave || onSaveToCollection || onMove || onRemove)

  return (
    <article className="lumen-pin">
      <div className="lumen-pin-media" style={{ aspectRatio: String(ratio) }}>
        <img
          className="lumen-pin-img"
          src={image.previewUrl || image.imageUrl}
          alt={image.tags || 'pixabay image'}
          loading="lazy"
          decoding="async"
        />
        {hasActions ? (
          <div className="lumen-pin-actions">
            {onSave ? (
              <button
                type="button"
                className="lumen-pin-btn"
                disabled={saving || saved}
                onClick={() => onSave(image)}
              >
                {saved ? 'saved' : 'save'}
              </button>
            ) : null}
            {onSaveToCollection ? (
              <button
                type="button"
                className="lumen-pin-btn lumen-pin-btn-fill"
                disabled={saving}
                onClick={() => onSaveToCollection(image)}
              >
                to board
              </button>
            ) : null}
            {onMove ? (
              <button
                type="button"
                className="lumen-pin-btn"
                disabled={saving}
                onClick={() => onMove(image)}
              >
                move
              </button>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                className="lumen-pin-btn lumen-pin-btn-danger"
                disabled={saving}
                onClick={() => onRemove(image)}
              >
                remove
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="lumen-pin-meta">
        <h3 className="lumen-pin-title">{label}</h3>
        {image.photographer ? (
          <p className="lumen-pin-credit">by {image.photographer}</p>
        ) : null}
      </div>
    </article>
  )
})
