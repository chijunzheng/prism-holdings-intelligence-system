export function GraphLegend() {
  return (
    <section className="graph-legend" aria-label="Graph legend">
      <p className="graph-legend__title">Legend</p>
      <div className="graph-legend__items">
        <span className="graph-legend__item">
          <i className="graph-legend__line graph-legend__line--positive" /> Positive edge
        </span>
        <span className="graph-legend__item">
          <i className="graph-legend__line graph-legend__line--negative" /> Negative edge
        </span>
        <span className="graph-legend__item">
          <i className="graph-legend__line graph-legend__line--ambiguous" /> Ambiguous edge
        </span>
        <span className="graph-legend__item">Thicker edge = larger magnitude</span>
        <span className="graph-legend__item">Transparent edge = lower confidence</span>
      </div>
    </section>
  )
}
