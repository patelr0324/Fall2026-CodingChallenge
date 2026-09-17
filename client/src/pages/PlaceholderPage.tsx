type PlaceholderPageProps = {
  outline: string
  solid: string
  blurb: string
}

export function PlaceholderPage({ outline, solid, blurb }: PlaceholderPageProps) {
  return (
    <section className="lumen-page">
      <p className="lumen-page-kicker">lumen / studio</p>
      <h1 className="lumen-page-title">
        <span>{outline}</span>
        {solid}
      </h1>
      <p className="lumen-page-blurb">{blurb}</p>
    </section>
  )
}
