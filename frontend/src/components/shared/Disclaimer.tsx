import { DISCLAIMER } from '@prism/shared'

interface DisclaimerProps {
  readonly compact?: boolean
}

export function Disclaimer({ compact = false }: DisclaimerProps) {
  return (
    <footer className={`disclaimer ${compact ? 'disclaimer--compact' : ''}`}>
      {DISCLAIMER}
    </footer>
  )
}
