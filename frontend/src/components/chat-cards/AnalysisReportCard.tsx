// AnalysisReportCard — single consolidated report replacing 5-6 separate cards.
// Wealthsimple-style: each section is a separate white card with gap between.
// Sections: Header, Portfolio Impact (open), Recommendations (open),
// Research Brief (collapsed), Action Bar.

import { useState } from 'react'
import type { Recommendation, RecommendationAction } from '@prism/shared'
import type { ActionCenterMode, AnalysisReportData } from './types'
import { TickerIcon } from '../common/TickerIcon'
import { downloadAdvisorPdf } from '../../utils/generate-advisor-summary'

// ── SVG Icon Components ──────────────────────────────

function ChevronIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`ar-chevron ${expanded ? 'ar-chevron--expanded' : ''}`}
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 12V14H12V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2V10M5 5L8 2L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 8a6 6 0 0110.89-3.48M14 2v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8a6 6 0 01-10.89 3.48M2 14v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────

interface AnalysisReportCardProps {
  readonly data: AnalysisReportData
  readonly onFollowUp?: (query: string) => void
  readonly onSavePlan?: (id: string) => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
  readonly onSwitchToHoldings?: () => void
}

type ExpandedSection = 'impact' | 'recommendations' | 'brief'

function formatDollar(amount: number): string {
  const sign = amount >= 0 ? '+' : ''
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString()}`
}

function formatChangeDollar(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString()}`
}

function directionLabel(direction: number): string {
  if (direction < -0.2) return 'Bearish'
  if (direction > 0.2) return 'Bullish'
  return 'Neutral'
}

/** Extract a short plain-text summary from markdown content (first sentence, max 120 chars). */
function extractSummary(markdown: string): string {
  // Strip markdown formatting: headers, bold, italic, bullets, numbered lists, tables, links
  const plain = markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^\|.*\|$/gm, '')           // table rows (lines starting and ending with |)
    .replace(/^[-|:\s]+$/gm, '')          // table separator rows (---|---|---)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links → text only
    .replace(/\n{2,}/g, '\n')            // collapse blank lines
    .trim()
  // First sentence: up to period+space or newline
  const match = plain.match(/^(.+?(?:\.|$))/)
  const sentence = match?.[1]?.trim() ?? plain.slice(0, 120)
  return sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence
}

function actionVerb(action: RecommendationAction['action']): string {
  switch (action) {
    case 'reduce': return 'Reduce'
    case 'increase': return 'Increase'
    case 'hold': return 'Hold'
    case 'add_new': return 'Add'
    case 'remove': return 'Remove'
  }
}

function actionColor(action: RecommendationAction['action']): string {
  switch (action) {
    case 'reduce':
    case 'remove':
      return 'var(--color-negative, #DC2626)'
    case 'increase':
    case 'add_new':
      return 'var(--color-positive, #16A34A)'
    case 'hold':
      return 'var(--color-text-muted, #71717A)'
  }
}

/** Generate context-aware follow-up chips from the actual analysis data. */
export function generateReportFollowUps(report: AnalysisReportData): readonly string[] {
  const chips: string[] = []
  const headline = report.signal.headline
  const netImpact = report.impactDelta.netImpactMidCad ?? 0
  const topHolding = report.impactDelta.affectedHoldings?.[0]

  // Signal-specific: counter-scenario
  if (headline.toLowerCase().includes('rate') || headline.toLowerCase().includes('interest')) {
    chips.push('What if rates move the other way?')
  } else if (headline.toLowerCase().includes('tariff') || headline.toLowerCase().includes('trade')) {
    chips.push('What if the tariffs get rolled back?')
  } else if (headline.toLowerCase().includes('oil') || headline.toLowerCase().includes('energy')) {
    chips.push('What if oil prices reverse?')
  } else {
    chips.push(`What if this signal doesn't materialize?`)
  }

  // Holding-specific depth
  if (topHolding) {
    chips.push(`Why is ${topHolding.ticker} most affected?`)
  }

  // Direction-aware (based on net dollar impact)
  if (netImpact < 0) {
    chips.push('Show me the worst case scenario')
  } else if (netImpact > 0) {
    chips.push('How sustainable is this upside?')
  }

  // Cross-signal interaction (always useful)
  chips.push('How does this interact with my other risks?')

  return chips.slice(0, 3)
}

export function AnalysisReportCard({
  data,
  onFollowUp,
  onSavePlan,
  onActionCenterMode,
  onSwitchToHoldings,
}: AnalysisReportCardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<ExpandedSection>>(
    new Set(['impact', 'recommendations']),
  )
  const [savedRecId, setSavedRecId] = useState<string | null>(null)
  const [showReanalyze, setShowReanalyze] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  const [reanalyzeInput, setReanalyzeInput] = useState('')

  const { verdict, impactDelta, intermediateArtifacts, researchBrief } = data
  const netImpact = impactDelta.netImpactMidCad

  // Compute aggregate direction and confidence from holding impacts
  const avgDirection = verdict.holdingImpacts.length > 0
    ? verdict.holdingImpacts.reduce((sum, h) => sum + h.direction, 0) / verdict.holdingImpacts.length
    : 0
  const avgConfidence = verdict.holdingImpacts.length > 0
    ? verdict.holdingImpacts.reduce((sum, h) => sum + h.confidence, 0) / verdict.holdingImpacts.length
    : 0
  const direction = directionLabel(avgDirection)
  const confidence = Math.round(avgConfidence * 100)

  function toggleSection(section: ExpandedSection) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  function handleExecutePlan(rec: Recommendation) {
    onSavePlan?.(rec.id)
    setSavedRecId(rec.id)
    onSwitchToHoldings?.()
  }

  function handleReanalyze(correction: string) {
    onFollowUp?.(`Re-analyze "${data.signal.headline}" with assumption: ${correction}`)
    setShowReanalyze(false)
    setReanalyzeInput('')
  }

  // Quick options for re-analyze (auto-generated from analysis)
  const quickOptions: string[] = []
  if (intermediateArtifacts?.debateResolution) {
    const debate = intermediateArtifacts.debateResolution
    if (debate.unresolvedDisagreements.length > 0) {
      quickOptions.push(debate.unresolvedDisagreements[0])
    }
  }
  if (quickOptions.length < 3) {
    quickOptions.push('Impact is smaller than projected')
    quickOptions.push('Timeline is longer than expected')
  }

  return (
    <div className="ar">
      {/* ── Header Card ── */}
      <div className="ar__card ar__header">
        <h3 className="ar__headline">{data.signal.headline}</h3>
        <div className="ar__meta">
          <span className="ar__impact">{formatDollar(netImpact)} estimated 1M impact</span>
          <span className={`ar__badge ar__badge--${direction.toLowerCase()}`}>
            {direction}
          </span>
          <span className="ar__badge ar__badge--neutral">{confidence}% confidence</span>
          <span className="ar__badge ar__badge--neutral">{data.agentCount} agents</span>
        </div>
      </div>

      {/* ── Portfolio Impact Card ── */}
      <div className="ar__card">
        <button
          type="button"
          className="ar__section-toggle"
          onClick={() => toggleSection('impact')}
          aria-expanded={expandedSections.has('impact')}
        >
          <ChevronIcon expanded={expandedSections.has('impact')} />
          <span className="ar__section-title">Portfolio Impact</span>
        </button>
        {expandedSections.has('impact') && (
          <div className="ar__section-body">
            <div className="ar__holdings">
              {impactDelta.affectedHoldings.map((h) => (
                <button
                  type="button"
                  key={h.ticker}
                  className="ar__holding-row"
                  onClick={() => onActionCenterMode?.({
                    mode: 'holding_detail',
                    ticker: h.ticker,
                    holdingData: h,
                  })}
                >
                  <TickerIcon ticker={h.ticker} size={20} />
                  <span className="ar__holding-name">{h.name}</span>
                  <span className={`ar__holding-impact ${h.impactMidCad < 0 ? 'ar__holding-impact--neg' : 'ar__holding-impact--pos'}`}>
                    {formatDollar(h.impactMidCad)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Recommendations ── */}
      <button
        type="button"
        className="ar__section-toggle ar__section-toggle--standalone"
        onClick={() => toggleSection('recommendations')}
        aria-expanded={expandedSections.has('recommendations')}
      >
        <ChevronIcon expanded={expandedSections.has('recommendations')} />
        <span className="ar__section-title">What You Can Do</span>
      </button>
      {expandedSections.has('recommendations') && (
        <div className="ar__recs">
          {verdict.recommendations.map((rec) => {
                const isSaved = savedRecId === rec.id
                return (
                  <div
                    key={rec.id}
                    className={`ar__rec ${rec.isDoNothing ? 'ar__rec--baseline' : ''}`}
                  >
                    {/* Header: title + cost/risk + saved tag */}
                    <div className="ar__rec-header">
                      <span className="ar__rec-title">{rec.title}</span>
                      {rec.isDoNothing && <span className="ar__baseline-tag">Baseline</span>}
                      {isSaved && (
                        <span className="ar__saved-tag">
                          <CheckIcon /> Planned
                        </span>
                      )}
                      <span className="ar__rec-meta-inline">
                        <span>{rec.estimatedCost}</span>
                        <span>{rec.riskReduction}</span>
                      </span>
                    </div>

                    {/* Description */}
                    <p className="ar__rec-desc">{rec.description}</p>

                    {/* Action rows — shows exactly what to do */}
                    {rec.actions && rec.actions.length > 0 && (
                      <div className="ar__rec-actions">
                        {rec.actions.map((act) => (
                          <div key={act.ticker} className="ar__rec-action-row">
                            <TickerIcon ticker={act.ticker} size={16} />
                            <span className="ar__rec-action-verb" style={{ color: actionColor(act.action) }}>
                              {actionVerb(act.action)}
                            </span>
                            <span className="ar__rec-action-ticker">{act.ticker}</span>
                            {act.suggestedChangeCad != null && (
                              <span className="ar__rec-action-amount" style={{ color: actionColor(act.action) }}>
                                {formatChangeDollar(act.suggestedChangeCad)}
                              </span>
                            )}
                            {act.currentValueCad != null && act.currentValueCad > 0 && (
                              <span className="ar__rec-action-current">
                                of ${Math.round(act.currentValueCad).toLocaleString()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Per-ticker rationale */}
                    {rec.actions && rec.actions.some((a) => a.rationale) && (
                      <div className="ar__rec-detail-rationales">
                        {rec.actions.filter((a) => a.rationale).map((act) => (
                          <p key={act.ticker} className="ar__rec-detail-rationale">
                            <strong>{act.ticker}:</strong> {act.rationale}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Tradeoffs */}
                    {rec.tradeoffs.length > 0 && (
                      <div className="ar__rec-detail-tradeoffs">
                        <strong>Tradeoffs</strong>
                        <ul>
                          {rec.tradeoffs.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Summary row */}
                    <div className="ar__rec-detail-summary">
                      <span>Estimated Cost: <strong>{rec.estimatedCost}</strong></span>
                      <span>Risk Reduction: <strong>{rec.riskReduction}</strong></span>
                    </div>

                    {/* Save / Saved button — visible for non-baseline */}
                    {!rec.isDoNothing && !isSaved && (
                      <button
                        type="button"
                        className="ar__btn-primary ar__rec-save-btn"
                        onClick={() => handleExecutePlan(rec)}
                      >
                        Save plan
                      </button>
                    )}
                    {isSaved && (
                      <div className="ar__rec-detail-confirmed">
                        <CheckIcon /> Plan added. View in Holdings tab.
                      </div>
                    )}
                  </div>
                )
              })}
        </div>
      )}

      {/* ── Research Brief Card ── */}
      <div className="ar__card">
        <div className="ar__brief-header">
          <button
            type="button"
            className="ar__section-toggle"
            onClick={() => toggleSection('brief')}
            aria-expanded={expandedSections.has('brief')}
          >
            <ChevronIcon expanded={expandedSections.has('brief')} />
            <span className="ar__section-title">Research Brief</span>
            <span className="ar__section-hint">Quality: {data.qualityScore}%</span>
          </button>
          {researchBrief && (
            <button
              type="button"
              className="ar__brief-view-link"
              onClick={() => onActionCenterMode?.({ mode: 'research_brief', brief: researchBrief })}
            >
              View details &rsaquo;
            </button>
          )}
        </div>
        {expandedSections.has('brief') && researchBrief && (
          <div className="ar__section-body">
            <div className="ar__brief-overview">
              <span className={`ar__brief-quality ${
                data.qualityScore >= 80 ? 'ar__brief-quality--high'
                  : data.qualityScore >= 60 ? 'ar__brief-quality--mid'
                  : 'ar__brief-quality--low'
              }`}>
                Quality: {data.qualityScore}%
              </span>
              <span className="ar__brief-sources">
                {researchBrief.sources.length} sources cited
              </span>
            </div>
            <ol className="ar__brief-toc">
              {researchBrief.sections.map((section, i) => (
                <li key={i}>
                  <span className="ar__brief-toc-title">{section.title}</span>
                  <span className="ar__brief-toc-summary">{extractSummary(section.content)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* ── Action Bar Card ── */}
      <div className="ar__card ar__action-bar">
        <button
          type="button"
          className="ar__action-btn"
          onClick={() => {
            const success = downloadAdvisorPdf(data)
            if (!success) setPdfError(true)
            else setPdfError(false)
          }}
        >
          <ShareIcon />
          <span>Download PDF</span>
        </button>
        <button
          type="button"
          className={`ar__action-btn ${showReanalyze ? 'ar__action-btn--active' : ''}`}
          onClick={() => setShowReanalyze(!showReanalyze)}
        >
          <RefreshIcon />
          <span>Re-analyze</span>
        </button>
      </div>

      {pdfError && (
        <div className="ar__card ar__panel">
          <p className="ar__panel-error">
            Pop-up blocked. Allow pop-ups for this site and try again.
          </p>
        </div>
      )}

      {/* ── Re-analyze Panel ── */}
      {showReanalyze && (
        <div className="ar__card ar__panel">
          <p>Change an assumption and re-run the full analysis pipeline.</p>
          <div className="ar__quick-options">
            {quickOptions.map((option, i) => (
              <button
                key={i}
                type="button"
                className="ar__quick-option"
                onClick={() => handleReanalyze(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="ar__custom-input">
            <input
              type="text"
              placeholder="Or type your own assumption..."
              value={reanalyzeInput}
              onChange={(e) => setReanalyzeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && reanalyzeInput.trim()) {
                  handleReanalyze(reanalyzeInput.trim())
                }
              }}
            />
            <button
              type="button"
              className="ar__btn-primary"
              disabled={!reanalyzeInput.trim()}
              onClick={() => reanalyzeInput.trim() && handleReanalyze(reanalyzeInput.trim())}
            >
              Run Analysis
            </button>
          </div>
        </div>
      )}

      {/* ── Disclaimer ── */}
      <p className="ar__disclaimer">
        This analysis is for informational purposes only. Past performance does not guarantee future results. Consult a qualified financial advisor before making investment decisions.
      </p>
    </div>
  )
}
