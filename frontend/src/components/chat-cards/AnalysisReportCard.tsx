// AnalysisReportCard — single consolidated report replacing 5-6 separate cards.
// Sections: Header, Portfolio Impact (open), Recommendations (open),
// How We Got Here (collapsed), Research Brief (collapsed), Action Bar.

import { useState } from 'react'
import type { Recommendation } from '@prism/shared'
import type { ActionCenterMode, AnalysisReportData } from './types'
import { TickerIcon } from '../common/TickerIcon'
import { downloadAdvisorSummary } from '../../utils/generate-advisor-summary'

interface AnalysisReportCardProps {
  readonly data: AnalysisReportData
  readonly onFollowUp?: (query: string) => void
  readonly onSavePlan?: (id: string) => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

type ExpandedSection = 'impact' | 'recommendations' | 'process' | 'brief'

function formatDollar(amount: number): string {
  const sign = amount >= 0 ? '+' : ''
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString()}`
}

function directionLabel(direction: number): string {
  if (direction < -0.2) return 'Bearish'
  if (direction > 0.2) return 'Bullish'
  return 'Neutral'
}

export function AnalysisReportCard({
  data,
  onFollowUp,
  onSavePlan,
  onActionCenterMode,
}: AnalysisReportCardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<ExpandedSection>>(
    new Set(['impact', 'recommendations']),
  )
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null)
  const [planSaved, setPlanSaved] = useState(false)
  const [watching, setWatching] = useState(false)
  const [showReanalyze, setShowReanalyze] = useState(false)
  const [reanalyzeInput, setReanalyzeInput] = useState('')
  const [showShare, setShowShare] = useState(false)

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

  function handleSelectRec(rec: Recommendation) {
    setSelectedRecId(rec.id)
  }

  function handleSavePlan() {
    if (selectedRecId) {
      onSavePlan?.(selectedRecId)
      setPlanSaved(true)
    }
  }

  function handleReanalyze(correction: string) {
    onFollowUp?.(`Re-analyze "${data.signal.headline}" with assumption: ${correction}`)
    setShowReanalyze(false)
    setReanalyzeInput('')
  }

  // ── Quick options for re-analyze (auto-generated from analysis)
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
    <div className="analysis-report">
      {/* ── Header ── */}
      <div className="analysis-report__header">
        <h3 className="analysis-report__headline">{data.signal.headline}</h3>
        <div className="analysis-report__meta">
          <span className="analysis-report__impact">{formatDollar(netImpact)} estimated 1M impact</span>
          <span className={`analysis-report__direction analysis-report__direction--${direction.toLowerCase()}`}>
            {direction}
          </span>
          <span className="analysis-report__confidence">{confidence}% confidence</span>
          <span className="analysis-report__agents">{data.agentCount} agents</span>
        </div>
      </div>

      {/* ── Portfolio Impact ── */}
      <button
        type="button"
        className="analysis-report__section-toggle"
        onClick={() => toggleSection('impact')}
      >
        <span>{expandedSections.has('impact') ? '\u25BE' : '\u25B8'} Portfolio Impact</span>
      </button>
      {expandedSections.has('impact') && (
        <div className="analysis-report__section">
          <div className="analysis-report__holdings">
            {impactDelta.affectedHoldings.map((h) => (
              <button
                type="button"
                key={h.ticker}
                className="analysis-report__holding-row"
                onClick={() => onActionCenterMode?.({
                  mode: 'holding_detail',
                  ticker: h.ticker,
                  holdingData: h,
                })}
              >
                <TickerIcon ticker={h.ticker} size={20} />
                <span className="analysis-report__holding-name">{h.name}</span>
                <span className={`analysis-report__holding-impact ${h.impactMidCad < 0 ? 'analysis-report__holding-impact--negative' : 'analysis-report__holding-impact--positive'}`}>
                  {formatDollar(h.impactMidCad)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Recommendations ── */}
      <button
        type="button"
        className="analysis-report__section-toggle"
        onClick={() => toggleSection('recommendations')}
      >
        <span>{expandedSections.has('recommendations') ? '\u25BE' : '\u25B8'} What You Can Do</span>
      </button>
      {expandedSections.has('recommendations') && (
        <div className="analysis-report__section">
          <div className="analysis-report__recommendations">
            {verdict.recommendations.map((rec) => (
              <button
                type="button"
                key={rec.id}
                className={`analysis-report__rec-option ${selectedRecId === rec.id ? 'analysis-report__rec-option--selected' : ''} ${rec.isDoNothing ? 'analysis-report__rec-option--baseline' : ''}`}
                onClick={() => handleSelectRec(rec)}
              >
                <div className="analysis-report__rec-header">
                  <span className="analysis-report__rec-radio">
                    {selectedRecId === rec.id ? '\u25C9' : '\u25CB'}
                  </span>
                  <span className="analysis-report__rec-title">{rec.title}</span>
                  {rec.isDoNothing && <span className="analysis-report__baseline-tag">Baseline</span>}
                </div>
                <p className="analysis-report__rec-desc">{rec.description}</p>
                <div className="analysis-report__rec-meta">
                  <span>Cost: {rec.estimatedCost}</span>
                  <span>Risk: {rec.riskReduction}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── How We Got Here ── */}
      <button
        type="button"
        className="analysis-report__section-toggle"
        onClick={() => toggleSection('process')}
      >
        <span>
          {expandedSections.has('process') ? '\u25BE' : '\u25B8'} How We Got Here
          {!expandedSections.has('process') && (
            <span className="analysis-report__section-hint">
              {' '}{data.agentCount} agents \u00B7 {data.debateRounds}-round debate \u00B7 10k stress scenarios
            </span>
          )}
        </span>
      </button>
      {expandedSections.has('process') && intermediateArtifacts && (
        <div className="analysis-report__section analysis-report__process">
          <div className="analysis-report__process-item">
            <strong>Analyst Team</strong>
            <p>{intermediateArtifacts.analystAssessments.length} specialists assessed the signal independently</p>
          </div>
          <div className="analysis-report__process-item">
            <strong>Debate</strong>
            <p>{intermediateArtifacts.debateResolution.rounds} rounds, {intermediateArtifacts.debateResolution.consensusDirection} consensus</p>
            <button
              type="button"
              className="analysis-report__link-btn"
              onClick={() => onActionCenterMode?.({
                mode: 'debate_transcript',
                debate: intermediateArtifacts.debateResolution,
              })}
            >
              View full debate
            </button>
          </div>
          <div className="analysis-report__process-item">
            <strong>Risk Challenges</strong>
            <p>{intermediateArtifacts.riskChallenge.challengedAssumptions.length} assumptions challenged, confidence adjusted by {Math.round(intermediateArtifacts.riskChallenge.recommendedConfidenceAdjustment * 100)}%</p>
          </div>
          <div className="analysis-report__process-item">
            <strong>Stress Test</strong>
            <p>{intermediateArtifacts.stressTest.numSimulations.toLocaleString()} Monte Carlo scenarios. Downside: ${Math.abs(Math.round(intermediateArtifacts.stressTest.downside.mid)).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* ── Research Brief ── */}
      <button
        type="button"
        className="analysis-report__section-toggle"
        onClick={() => toggleSection('brief')}
      >
        <span>
          {expandedSections.has('brief') ? '\u25BE' : '\u25B8'} Research Brief
          {!expandedSections.has('brief') && (
            <span className="analysis-report__section-hint">
              {' '}Quality: {data.qualityScore}%
            </span>
          )}
        </span>
      </button>
      {expandedSections.has('brief') && researchBrief && (
        <div className="analysis-report__section">
          <div className="analysis-report__brief-preview">
            <p>{researchBrief.sections[0]?.content.slice(0, 200) ?? researchBrief.fullText.slice(0, 200)}...</p>
            <button
              type="button"
              className="analysis-report__link-btn"
              onClick={() => onActionCenterMode?.({ mode: 'research_brief', brief: researchBrief })}
            >
              View full brief
            </button>
          </div>
        </div>
      )}

      {/* ── Action Bar ── */}
      <div className="analysis-report__action-bar">
        <button
          type="button"
          className={`analysis-report__action-btn ${planSaved ? 'analysis-report__action-btn--active' : ''}`}
          disabled={!selectedRecId || planSaved}
          onClick={handleSavePlan}
        >
          {planSaved ? '\u2713 Plan Saved' : '\u2713 Save Plan'}
        </button>
        <button
          type="button"
          className={`analysis-report__action-btn ${showShare ? 'analysis-report__action-btn--active' : ''}`}
          onClick={() => setShowShare(!showShare)}
        >
          \u2197 Share
        </button>
        <button
          type="button"
          className={`analysis-report__action-btn ${watching ? 'analysis-report__action-btn--active' : ''}`}
          onClick={() => setWatching(!watching)}
          title={watching ? 'Prism will check for changes to this signal when you next open the app.' : 'Watch for signal changes'}
        >
          {watching ? '\uD83D\uDC41 Watching' : '\uD83D\uDC41 Watch'}
        </button>
        <button
          type="button"
          className={`analysis-report__action-btn ${showReanalyze ? 'analysis-report__action-btn--active' : ''}`}
          onClick={() => setShowReanalyze(!showReanalyze)}
        >
          \u21BB Re-analyze
        </button>
      </div>

      {/* ── Share Panel ── */}
      {showShare && (
        <div className="analysis-report__share-panel">
          <p>Generate a 1-page summary for your advisor or personal records.</p>
          <div className="analysis-report__share-actions">
            <button
              type="button"
              className="analysis-report__btn-primary"
              onClick={() => {
                downloadAdvisorSummary(data)
                setShowShare(false)
              }}
            >
              Download (.md)
            </button>
            <button
              type="button"
              className="analysis-report__btn-secondary"
              onClick={() => setShowShare(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Re-analyze Panel ── */}
      {showReanalyze && (
        <div className="analysis-report__reanalyze-panel">
          <p>Change an assumption and re-run the full analysis pipeline.</p>
          <div className="analysis-report__quick-options">
            {quickOptions.map((option, i) => (
              <button
                key={i}
                type="button"
                className="analysis-report__quick-option"
                onClick={() => handleReanalyze(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="analysis-report__custom-input">
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
              className="analysis-report__btn-primary"
              disabled={!reanalyzeInput.trim()}
              onClick={() => reanalyzeInput.trim() && handleReanalyze(reanalyzeInput.trim())}
            >
              Run Analysis
            </button>
          </div>
        </div>
      )}

      {/* ── Follow-up chips ── */}
      {onFollowUp && (
        <div className="analysis-report__follow-ups">
          <button
            type="button"
            className="chat-card__follow-up-pill"
            onClick={() => onFollowUp('What if rates don\'t change?')}
          >
            What if rates don't change?
          </button>
          <button
            type="button"
            className="chat-card__follow-up-pill"
            onClick={() => onFollowUp('Show me the worst case scenario')}
          >
            Show me the worst case
          </button>
          <button
            type="button"
            className="chat-card__follow-up-pill"
            onClick={() => onFollowUp('How does this interact with my other risks?')}
          >
            How does this interact with my other risks?
          </button>
        </div>
      )}

      {/* ── Disclaimer ── */}
      <p className="analysis-report__disclaimer">
        This analysis is for informational purposes only. Past performance does not guarantee future results. Consult a qualified financial advisor before making investment decisions.
      </p>
    </div>
  )
}
