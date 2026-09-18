import type { ReactNode } from 'react'

type MasonryGridProps = {
  children: ReactNode
}

export function MasonryGrid({ children }: MasonryGridProps) {
  return <div className="lumen-masonry">{children}</div>
}
