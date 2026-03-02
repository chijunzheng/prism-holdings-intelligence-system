import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Holding, Signal } from '@prism/shared'
import type { SessionSummary } from '../../hooks/useSessions'

// ── Result types ──────────────────────────────────────────

type SearchResult =
  | { readonly kind: 'session'; readonly id: string; readonly title: string; readonly meta: string }
  | { readonly kind: 'holding'; readonly id: string; readonly title: string; readonly meta: string; readonly ticker: string }
  | { readonly kind: 'signal'; readonly id: string; readonly title: string; readonly meta: string; readonly signal: Signal }

// ── Props ─────────────────────────────────────────────────

interface SearchModalProps {
  readonly sessions: readonly SessionSummary[]
  readonly holdings: readonly Holding[]
  readonly signals: readonly Signal[]
  readonly onSelectSession: (sessionId: string) => void
  readonly onSelectHolding: (ticker: string) => void
  readonly onSelectSignal: (signal: Signal) => void
  readonly onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCad(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const SECTION_LABELS: Record<SearchResult['kind'], string> = {
  session: 'Sessions',
  holding: 'Holdings',
  signal: 'Signals',
}

// ── Icons ─────────────────────────────────────────────────

const Icons = {
  session: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  holding: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 3h-8l-2 4h12z" />
    </svg>
  ),
  signal: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
} as const

// ── Component ─────────────────────────────────────────────

export function SearchModal({
  sessions,
  holdings,
  signals,
  onSelectSession,
  onSelectHolding,
  onSelectSignal,
  onClose,
}: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Build unified search results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: SearchResult[] = []

    // Sessions
    const matchedSessions = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q) || s.type.toLowerCase().includes(q))
      : sessions
    for (const s of matchedSessions) {
      out.push({ kind: 'session', id: s.id, title: s.title, meta: formatRelativeTime(s.updatedAt) })
    }

    // Holdings — dedupe by ticker (same ticker can appear in multiple accounts)
    const seen = new Set<string>()
    const matchedHoldings = holdings.filter((h) => {
      if (seen.has(h.ticker)) return false
      seen.add(h.ticker)
      if (!q) return true
      return h.ticker.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)
    })
    for (const h of matchedHoldings) {
      out.push({ kind: 'holding', id: h.ticker, title: `${h.ticker} — ${h.name}`, meta: formatCad(h.valueCad), ticker: h.ticker })
    }

    // Signals
    const matchedSignals = q
      ? signals.filter((s) => s.headline.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      : signals
    for (const s of matchedSignals) {
      out.push({ kind: 'signal', id: s.id, title: s.headline, meta: s.urgency, signal: s })
    }

    return out
  }, [query, sessions, holdings, signals])

  // Flat list of selectable items (excludes section headers)
  const selectableCount = results.length

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [selectableCount])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      switch (result.kind) {
        case 'session':
          onSelectSession(result.id)
          break
        case 'holding':
          onSelectHolding(result.ticker)
          break
        case 'signal':
          onSelectSignal(result.signal)
          break
      }
      onClose()
    },
    [onSelectSession, onSelectHolding, onSelectSignal, onClose],
  )

  // Keyboard nav
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, selectableCount - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && selectableCount > 0) {
        e.preventDefault()
        handleSelect(results[activeIndex])
      }
    },
    [selectableCount, activeIndex, handleSelect, results],
  )

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const activeEl = list.querySelector('[data-active="true"]') as HTMLElement | null
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  // Group results by kind for section headers
  const grouped = useMemo(() => {
    const groups: { kind: SearchResult['kind']; items: { result: SearchResult; flatIndex: number }[] }[] = []
    let flatIndex = 0
    let currentKind: SearchResult['kind'] | null = null

    for (const result of results) {
      if (result.kind !== currentKind) {
        currentKind = result.kind
        groups.push({ kind: result.kind, items: [] })
      }
      groups[groups.length - 1].items.push({ result, flatIndex })
      flatIndex++
    }

    return groups
  }, [results])

  return (
    <div className="search-modal__backdrop" onClick={handleBackdropClick}>
      <div className="search-modal" role="dialog" aria-label="Search">
        <div className="search-modal__header">
          <span className="search-modal__search-icon">{Icons.search}</span>
          <input
            ref={inputRef}
            type="text"
            className="search-modal__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search sessions, holdings, signals..."
          />
          <button
            type="button"
            className="search-modal__close"
            onClick={onClose}
            aria-label="Close search"
          >
            {Icons.close}
          </button>
        </div>

        <div className="search-modal__results" ref={listRef}>
          {results.length === 0 && (
            <div className="search-modal__empty">
              {query ? 'No results found' : 'Nothing to search yet'}
            </div>
          )}
          {grouped.map((group) => (
            <div key={group.kind}>
              <div className="search-modal__section-label">
                {SECTION_LABELS[group.kind]}
              </div>
              {group.items.map(({ result, flatIndex }) => (
                <button
                  key={result.id}
                  type="button"
                  className={`search-modal__item ${flatIndex === activeIndex ? 'search-modal__item--active' : ''}`}
                  data-active={flatIndex === activeIndex}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setActiveIndex(flatIndex)}
                >
                  <span className="search-modal__item-icon">
                    {Icons[result.kind]}
                  </span>
                  <span className="search-modal__item-title">{result.title}</span>
                  <span className="search-modal__item-meta">{result.meta}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
