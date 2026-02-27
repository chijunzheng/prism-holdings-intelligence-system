import type { Signal } from '@prism/shared'

interface SignalStoryProps {
  readonly signal: Signal
  readonly portfolioSummary?: string
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function SignalStory({ signal, portfolioSummary }: SignalStoryProps) {
  return (
    <section className="signal-story">
      <h1 className="signal-story__headline">{signal.headline}</h1>

      <div className="signal-story__meta">
        <span className={`signal-story__urgency signal-story__urgency--${signal.urgency}`}>
          {signal.urgency}
        </span>
        <span>{signal.temporalClassification === 'transient' ? 'Short-term' : signal.temporalClassification === 'structural' ? 'Long-term shift' : 'Uncertain duration'}</span>
        <span>{formatDate(signal.detectedAt)}</span>
      </div>

      <div className="signal-story__section">
        <p className="signal-story__section-label">What happened</p>
        <p className="signal-story__section-text">{signal.description}</p>
      </div>

      {portfolioSummary && (
        <div className="signal-story__section">
          <p className="signal-story__section-label">Why it matters to you</p>
          <p className="signal-story__section-text">{portfolioSummary}</p>
        </div>
      )}
    </section>
  )
}
