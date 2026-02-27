import type { Signal } from '@prism/shared'

interface EvidenceSectionProps {
  readonly signal: Signal
}

export function EvidenceSection({ signal }: EvidenceSectionProps) {
  if (signal.sources.length === 0) return null

  return (
    <section className="evidence-section">
      <h2 className="evidence-section__title">Evidence</h2>
      <div className="evidence-section__list">
        {signal.sources.map((source, i) => (
          <div key={`${source.url}-${i}`} className="evidence-section__item">
            <a
              className="evidence-section__source"
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.title}
            </a>
            {source.publisher && (
              <span className="evidence-section__publisher">{source.publisher}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
