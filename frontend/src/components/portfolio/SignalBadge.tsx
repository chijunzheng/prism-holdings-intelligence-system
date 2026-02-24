import type { TemporalClassification } from '@prism/shared'
import { getBadgeVariant } from './signal-utils'

interface SignalBadgeProps {
  readonly classification: TemporalClassification
}

const LABELS: Record<TemporalClassification, string> = {
  transient: 'Transient',
  structural: 'Structural',
  ambiguous: 'Ambiguous',
}

export function SignalBadge({ classification }: SignalBadgeProps) {
  const variant = getBadgeVariant(classification)

  return (
    <span className={`signal-badge signal-badge--${variant}`}>
      {LABELS[variant]}
    </span>
  )
}
