import type { ReactNode } from 'react'

type MasonryGridProps = {
  children: ReactNode
}

/** CSS multi-column masonry wrapper (see `.lumen-masonry` in index.css) */
export function MasonryGrid({ children }: MasonryGridProps) {
  return <div className="lumen-masonry">{children}</div>
}
