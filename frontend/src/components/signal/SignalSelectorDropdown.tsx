import { useEffect, useMemo, useRef, useState } from 'react'
import type { Signal } from '@prism/shared'

interface SignalSelectorDropdownProps {
  readonly signals: ReadonlyArray<Signal>
  readonly selectedSignalId: string | null
  readonly onSelect: (signalId: string | null) => void
  readonly label?: string
}

const ALL_ID = '__all__'

export function SignalSelectorDropdown({
  signals,
  selectedSignalId,
  onSelect,
  label = 'Signal regime',
}: SignalSelectorDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent): void {
      const target = event.target as Node | null
      if (!target) return
      if (!rootRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.id === selectedSignalId) ?? null,
    [selectedSignalId, signals],
  )

  const options = useMemo(
    () => [
      {
        id: ALL_ID,
        headline: 'All active signals',
        urgency: null as Signal['urgency'] | null,
      },
      ...signals.map((signal) => ({
        id: signal.id,
        headline: signal.headline,
        urgency: signal.urgency,
      })),
    ],
    [signals],
  )

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return options
    return options.filter((option) => option.headline.toLowerCase().includes(trimmed))
  }, [options, query])

  const selectedLabel = selectedSignal?.headline ?? 'All active signals'

  return (
    <div className="signal-selector" ref={rootRef}>
      <span className="signal-selector__label">{label}</span>
      <button
        type="button"
        className="signal-selector__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="signal-selector__trigger-text">{selectedLabel}</span>
        <span className="signal-selector__chevron">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="signal-selector__menu" role="listbox">
          <input
            type="text"
            className="signal-selector__search"
            placeholder="Search signal"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <div className="signal-selector__options">
            {filteredOptions.map((option) => {
              const isSelected =
                option.id === ALL_ID ? selectedSignalId === null : option.id === selectedSignalId
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`signal-selector__option${isSelected ? ' signal-selector__option--active' : ''}`}
                  onClick={() => {
                    onSelect(option.id === ALL_ID ? null : option.id)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  {option.urgency ? (
                    <span className={`signal-selector__dot signal-selector__dot--${option.urgency}`} />
                  ) : (
                    <span className="signal-selector__all-dot">All</span>
                  )}
                  <span className="signal-selector__option-text">{option.headline}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
