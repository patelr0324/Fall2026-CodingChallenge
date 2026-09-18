import { useEffect, useId, useRef, useState } from 'react'

const COLOR_OPTIONS = [
  'red',
  'orange',
  'yellow',
  'green',
  'turquoise',
  'blue',
  'lilac',
  'pink',
  'white',
  'gray',
  'black',
  'brown',
  'grayscale',
] as const

type ColorFilterDropdownProps = {
  value: string
  onChange: (value: string) => void
}

/** color chips for Pixabay's `colors` query param (native select was unreadable). */
export function ColorFilterDropdown({
  value,
  onChange,
}: ColorFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()
  const label = value || 'any'

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(next: string) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="lumen-field lumen-discover-color" ref={rootRef}>
      <span id={`${listId}-label`}>color</span>
      <button
        type="button"
        className="lumen-color-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${listId}-label`}
        onClick={() => setOpen((v) => !v)}
      >
        {value ? (
          <span className="lumen-color-swatch" data-color={value} aria-hidden />
        ) : null}
        <span>{label}</span>
        <span className="lumen-color-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          className="lumen-color-menu"
          role="listbox"
          aria-label="filter by color"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === ''}
            className="lumen-color-chip"
            data-active={value === '' ? 'true' : 'false'}
            onClick={() => pick('')}
          >
            any
          </button>
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={value === c}
              className="lumen-color-chip"
              data-color={c}
              data-active={value === c ? 'true' : 'false'}
              onClick={() => pick(c)}
            >
              <span className="lumen-color-swatch" data-color={c} aria-hidden />
              <span className="lumen-color-name">{c}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
