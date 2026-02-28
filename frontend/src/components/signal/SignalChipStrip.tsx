import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Signal } from '@prism/shared'

interface SignalChipStripProps {
  readonly signals: ReadonlyArray<Signal>
}

const MAX_VISIBLE = 4

export function SignalChipStrip({ signals }: SignalChipStripProps) {
  const { signalId } = useParams<{ signalId: string }>()
  const navigate = useNavigate()
  const [showOverflow, setShowOverflow] = useState(false)

  const isAllView = !signalId
  const visible = signals.slice(0, MAX_VISIBLE)
  const overflow = signals.slice(MAX_VISIBLE)

  const handleSelect = useCallback(
    (id: string | null) => {
      if (id === null) {
        navigate('/signals')
      } else {
        navigate(`/signals/${encodeURIComponent(id)}`)
      }
      setShowOverflow(false)
    },
    [navigate],
  )

  return (
    <div className="signal-chip-strip">
      <button
        type="button"
        className={`signal-chip-strip__chip${isAllView ? ' signal-chip-strip__chip--active' : ''}`}
        onClick={() => handleSelect(null)}
      >
        All
      </button>

      {visible.map((signal) => (
        <button
          key={signal.id}
          type="button"
          className={`signal-chip-strip__chip${signal.id === signalId ? ' signal-chip-strip__chip--active' : ''}`}
          onClick={() => handleSelect(signal.id)}
          title={signal.headline}
        >
          <span
            className={`signal-chip-strip__dot signal-chip-strip__dot--${signal.urgency}`}
          />
          <span className="signal-chip-strip__label">
            {truncate(signal.headline, 32)}
          </span>
        </button>
      ))}

      {overflow.length > 0 && (
        <div className="signal-chip-strip__overflow-wrap">
          <button
            type="button"
            className="signal-chip-strip__chip signal-chip-strip__chip--more"
            onClick={() => setShowOverflow((prev) => !prev)}
          >
            +{overflow.length} more
          </button>

          {showOverflow && (
            <div className="signal-chip-strip__dropdown">
              {overflow.map((signal) => (
                <button
                  key={signal.id}
                  type="button"
                  className={`signal-chip-strip__dropdown-item${signal.id === signalId ? ' signal-chip-strip__dropdown-item--active' : ''}`}
                  onClick={() => handleSelect(signal.id)}
                >
                  <span
                    className={`signal-chip-strip__dot signal-chip-strip__dot--${signal.urgency}`}
                  />
                  {signal.headline}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '\u2026'
}
