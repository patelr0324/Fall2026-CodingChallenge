import { memo, useState, type SubmitEvent } from 'react'
import { ColorFilterDropdown } from './ColorFilterDropdown'

type DiscoverSearchBarProps = {
  initialQuery?: string
  color: string
  loading: boolean
  onSearch: (query: string) => void
  onColorChange: (color: string) => void
}

/** Isolated so typing does not re-render the masonry grid */
export const DiscoverSearchBar = memo(function DiscoverSearchBar({
  initialQuery = '',
  color,
  loading,
  onSearch,
  onColorChange,
}: DiscoverSearchBarProps) {
  const [draft, setDraft] = useState(initialQuery)

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    onSearch(draft.trim())
  }

  return (
    <form className="lumen-discover-search" onSubmit={handleSubmit}>
      <label className="lumen-field lumen-discover-field">
        <span>search</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="leave blank for editors’ picks"
        />
      </label>
      <ColorFilterDropdown value={color} onChange={onColorChange} />
      <button className="lumen-btn lumen-btn-sm" type="submit" disabled={loading}>
        {loading ? 'loading…' : 'search'}
      </button>
    </form>
  )
})
