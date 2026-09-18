export type BoardOption = {
  id: string
  title: string
  isLibrary?: boolean
}

type CollectionPickerModalProps = {
  title: string
  collections: BoardOption[]
  selectedId: string
  onSelect: (id: string) => void
  loading?: boolean
  confirming?: boolean
  allowCreate?: boolean
  newTitle?: string
  onNewTitleChange?: (value: string) => void
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

/** to pick/create a collection when saving/moving an image. */
export function CollectionPickerModal({
  title,
  collections,
  selectedId,
  onSelect,
  loading = false,
  confirming = false,
  allowCreate = false,
  newTitle = '',
  onNewTitleChange,
  confirmLabel = 'save',
  onConfirm,
  onClose,
}: CollectionPickerModalProps) {
  const creatingNew = allowCreate && newTitle.trim().length > 0
  const canConfirm =
    !confirming && (creatingNew || selectedId.length > 0)

  return (
    <div
      className="lumen-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="lumen-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="lumen-page-kicker">{title}</p>
        {loading ? (
          <p className="lumen-page-blurb">loading boards…</p>
        ) : (
          <>
            {collections.length > 0 ? (
              <label className="lumen-field">
                <span>collection</span>
                <select
                  className="lumen-select"
                  value={selectedId}
                  onChange={(e) => {
                    onSelect(e.target.value)
                    onNewTitleChange?.('')
                  }}
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.isLibrary ? 'library' : c.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {allowCreate ? (
              <label className="lumen-field">
                <span>{collections.length > 0 ? 'or create new' : 'new board name'}</span>
                <input
                  value={newTitle}
                  onChange={(e) => onNewTitleChange?.(e.target.value)}
                  placeholder="untitled board"
                />
              </label>
            ) : null}

            {!allowCreate && collections.length === 0 ? (
              <p className="lumen-page-blurb">no other boards available.</p>
            ) : null}

            <div className="lumen-modal-actions">
              <button
                type="button"
                className="lumen-btn"
                onClick={onConfirm}
                disabled={!canConfirm}
              >
                {confirming ? 'working…' : confirmLabel}
              </button>
              <button
                type="button"
                className="lumen-btn lumen-btn-ghost-inline"
                onClick={onClose}
              >
                cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
