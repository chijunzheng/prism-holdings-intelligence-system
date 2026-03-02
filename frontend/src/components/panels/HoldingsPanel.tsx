// HoldingsPanel — Wealthsimple-style card groups showing portfolio holdings.
// Each account is a rounded card; holdings are rows within.
// Includes "Planned Changes" section from saved recommendation candidates.

import { useState } from 'react'
import type { Candidate, Portfolio } from '@prism/shared'
import { TickerIcon } from '../common/TickerIcon'

interface HoldingsPanelProps {
  readonly portfolio: Portfolio | null | undefined
  readonly isLoading: boolean
  readonly onHoldingClick?: (ticker: string) => void
  readonly candidates?: readonly Candidate[]
  readonly onCandidateAction?: (id: string, action: 'explore' | 'dismiss') => void
  readonly onPreviewPlan?: () => void
}

const ACCOUNT_LABELS: Record<string, string> = {
  TFSA: 'TFSA',
  RRSP: 'RRSP',
  FHSA: 'FHSA',
  LIRA: 'LIRA',
  NON_REGISTERED: 'Non-Registered',
}

function SkeletonCards() {
  return (
    <div className="holdings-panel__skeleton">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="holdings-panel__skeleton-card">
          <div className="holdings-panel__skeleton-label" />
          {Array.from({ length: 2 }, (_, j) => (
            <div key={j} className="holdings-panel__skeleton-row">
              <div className="holdings-panel__skeleton-circle" />
              <div className="holdings-panel__skeleton-lines">
                <div className="holdings-panel__skeleton-bar holdings-panel__skeleton-bar--name" />
                <div className="holdings-panel__skeleton-bar holdings-panel__skeleton-bar--sub" />
              </div>
              <div className="holdings-panel__skeleton-bar holdings-panel__skeleton-bar--value" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const ACTION_VERB_MAP: Record<Candidate['action'], string> = {
  reduce: 'Reduce',
  increase: 'Increase',
  hold: 'Hold',
  add_new: 'Add',
  remove: 'Remove',
}

function PlannedChangesSection({
  candidates,
  onCandidateAction,
  onPreviewPlan,
}: {
  readonly candidates: readonly Candidate[]
  readonly onCandidateAction?: (id: string, action: 'explore' | 'dismiss') => void
  readonly onPreviewPlan?: () => void
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set())

  if (candidates.length === 0) {
    return (
      <div className="holdings-panel__planned">
        <h4 className="holdings-panel__planned-title">Planned Changes</h4>
        <p className="holdings-panel__planned-empty">
          Save plans from recommendations to track them here
        </p>
      </div>
    )
  }

  // Group by sourceLabel
  const groups = new Map<string, readonly Candidate[]>()
  for (const c of candidates) {
    const existing = groups.get(c.sourceLabel) ?? []
    groups.set(c.sourceLabel, [...existing, c])
  }

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="holdings-panel__planned">
      <h4 className="holdings-panel__planned-title">
        Planned Changes ({candidates.length})
      </h4>

      {[...groups.entries()].map(([label, items]) => {
        const isCollapsed = collapsedGroups.has(label)
        return (
          <div key={label} className="holdings-panel__planned-group">
            <button
              type="button"
              className="holdings-panel__planned-group-header"
              onClick={() => toggleGroup(label)}
            >
              <span className={`holdings-panel__planned-chevron ${isCollapsed ? '' : 'holdings-panel__planned-chevron--open'}`}>
                ▸
              </span>
              <span className="holdings-panel__planned-group-label">{label}</span>
              <span className="holdings-panel__planned-group-count">{items.length}</span>
            </button>

            {!isCollapsed && (
              <ul className="holdings-panel__planned-list">
                {items.map((c) => (
                  <li key={c.id} className="holdings-panel__planned-item">
                    <TickerIcon ticker={c.ticker} size={24} />
                    <span className={`holdings-panel__planned-verb holdings-panel__planned-verb--${c.action}`}>
                      {ACTION_VERB_MAP[c.action]}
                    </span>
                    <span className="holdings-panel__planned-ticker">{c.ticker}</span>
                    {c.suggestedChangeCad !== undefined && (
                      <span className="holdings-panel__planned-amount">
                        {c.suggestedChangeCad >= 0 ? '+' : ''}${Math.abs(c.suggestedChangeCad).toLocaleString()}
                      </span>
                    )}
                    <button
                      type="button"
                      className="holdings-panel__planned-dismiss"
                      onClick={() => onCandidateAction?.(c.id, 'dismiss')}
                      aria-label={`Dismiss ${c.ticker}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      {onPreviewPlan && (
        <button
          type="button"
          className="holdings-panel__preview-btn"
          onClick={onPreviewPlan}
        >
          Preview Plan Impact
        </button>
      )}
    </div>
  )
}

const MASKED_VALUE = '$\u2022\u2022\u2022\u2022\u2022\u2022'
const MASKED_CHANGE = '\u2022\u2022\u2022\u2022'

function EyeIcon({ open }: { readonly open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

type ReturnPeriod = 'today' | 'all_time'

function PillToggle({ value, onChange }: { readonly value: ReturnPeriod; readonly onChange: (v: ReturnPeriod) => void }) {
  return (
    <div className="holdings-panel__pill-toggle">
      <button
        type="button"
        className={`holdings-panel__pill ${value === 'today' ? 'holdings-panel__pill--active' : ''}`}
        onClick={() => onChange('today')}
      >
        Today
      </button>
      <button
        type="button"
        className={`holdings-panel__pill ${value === 'all_time' ? 'holdings-panel__pill--active' : ''}`}
        onClick={() => onChange('all_time')}
      >
        All time
      </button>
    </div>
  )
}

export function HoldingsPanel({ portfolio, isLoading, onHoldingClick, candidates, onCandidateAction, onPreviewPlan }: HoldingsPanelProps) {
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [returnPeriod, setReturnPeriod] = useState<ReturnPeriod>('today')

  if (isLoading) {
    return (
      <div className="holdings-panel">
        <SkeletonCards />
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="holdings-panel">
        <div className="holdings-panel__empty">
          Connect your portfolio to get started
        </div>
      </div>
    )
  }

  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)
  const totalValue = allHoldings.reduce((sum, h) => sum + h.valueCad, 0)

  const totalDayChange = allHoldings.reduce((sum, h) => sum + (h.dayChangeCad ?? 0), 0)
  const totalDayPct = totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0

  // All-time returns computed from live value vs book value (cost basis)
  const totalBookValue = allHoldings.reduce((sum, h) => sum + (h.bookValueCad ?? h.valueCad), 0)
  const totalAllTimeChange = totalValue - totalBookValue
  const totalAllTimePct = totalBookValue > 0 ? (totalAllTimeChange / totalBookValue) * 100 : 0

  const displayChange = returnPeriod === 'today' ? totalDayChange : totalAllTimeChange
  const displayPct = returnPeriod === 'today' ? totalDayPct : totalAllTimePct
  const isDisplayPositive = displayChange >= 0
  const displaySign = isDisplayPositive ? '+' : ''

  return (
    <div className="holdings-panel">
      <div className="holdings-panel__total-display">
        <div className="holdings-panel__total-row">
          <span className="holdings-panel__total-value">
            {balanceVisible
              ? `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : MASKED_VALUE}
          </span>
          <button
            type="button"
            className="holdings-panel__visibility-toggle"
            onClick={() => setBalanceVisible((v) => !v)}
            aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
          >
            <EyeIcon open={balanceVisible} />
          </button>
        </div>
        <div className="holdings-panel__change-row">
          <span className={`holdings-panel__total-change ${isDisplayPositive ? 'holdings-panel__day-change--positive' : 'holdings-panel__day-change--negative'}`}>
            {balanceVisible
              ? `${displaySign}$${Math.abs(displayChange).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${displaySign}${displayPct.toFixed(2)}%)`
              : MASKED_CHANGE}
          </span>
          <PillToggle value={returnPeriod} onChange={setReturnPeriod} />
        </div>
      </div>

      <div className="holdings-panel__groups">
        {portfolio.accounts.map((account) => {
          const label = ACCOUNT_LABELS[account.type] ?? account.type
          const isFhsa = account.type === 'FHSA'

          return (
            <div key={account.id} className="holdings-panel__card">
              <div className="holdings-panel__card-header">
                <span className="holdings-panel__account-label">{label}</span>
                {isFhsa && (
                  <span className="holdings-panel__account-badge">Short horizon</span>
                )}
              </div>

              <ul className="holdings-panel__list">
                {account.holdings.map((h) => {
                  const sharesLabel = `${h.units.toLocaleString()} ${h.units === 1 ? 'share' : 'shares'}`
                  const bookVal = h.bookValueCad ?? h.valueCad
                  const allTimeChange = h.valueCad - bookVal
                  const allTimePct = bookVal > 0 ? (allTimeChange / bookVal) * 100 : 0
                  const changeCad = returnPeriod === 'today' ? (h.dayChangeCad ?? 0) : allTimeChange
                  const changePct = returnPeriod === 'today' ? (h.dayChangePct ?? 0) : allTimePct
                  const isPositive = changeCad >= 0
                  const changeSign = isPositive ? '+' : ''

                  return (
                    <li
                      key={`${account.id}-${h.ticker}`}
                      className="holdings-panel__item"
                      onClick={() => onHoldingClick?.(h.ticker)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onHoldingClick?.(h.ticker)
                      }}
                    >
                      <TickerIcon ticker={h.ticker} size={32} />
                      <span className="holdings-panel__info">
                        <span className="holdings-panel__ticker">{h.ticker}</span>
                        <span className="holdings-panel__shares">{sharesLabel}</span>
                      </span>
                      <span className="holdings-panel__values">
                        <span className="holdings-panel__value">
                          {balanceVisible
                            ? `$${h.valueCad.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : MASKED_VALUE}
                        </span>
                        <span className={`holdings-panel__day-change ${isPositive ? 'holdings-panel__day-change--positive' : 'holdings-panel__day-change--negative'}`}>
                          {balanceVisible
                            ? `${changeSign}$${Math.abs(changeCad).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${changeSign}${changePct.toFixed(2)}%)`
                            : MASKED_CHANGE}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {candidates && (
        <PlannedChangesSection
          candidates={candidates}
          onCandidateAction={onCandidateAction}
          onPreviewPlan={onPreviewPlan}
        />
      )}
    </div>
  )
}
