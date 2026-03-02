// ActionCenter — mode-based contextual detail panel.
// Responds to card interactions: shows holding details, debate transcripts,
// recommendation comparisons, reasoning traces, or research briefs.

import type { ActionCenterMode, ReasoningTraceData } from '../chat-cards/types'
import { renderMarkdown } from '../chat/render-markdown'

interface ActionCenterProps {
  readonly mode: ActionCenterMode
  readonly onClose: () => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

export function ActionCenter({ mode, onClose, onActionCenterMode }: ActionCenterProps) {
  return (
    <aside className="action-center">
      <div className="action-center__header">
        <div>
          <h3>Analysis Details</h3>
          <p>{getModeSubtitle(mode)}</p>
        </div>
        <button
          type="button"
          className="action-center__close"
          onClick={onClose}
          aria-label="Close details panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {mode.mode === 'idle' && <IdleView />}
      {mode.mode === 'holding_detail' && <HoldingDetailView ticker={mode.ticker} holdingData={mode.holdingData} />}
      {mode.mode === 'debate_transcript' && <DebateTranscriptView debate={mode.debate} />}
      {mode.mode === 'comparison' && <ComparisonView recommendations={mode.recommendations} />}
      {mode.mode === 'reasoning_trace' && <ReasoningTraceView trace={mode.trace} />}
      {mode.mode === 'research_brief' && <ResearchBriefView brief={mode.brief} />}
      {mode.mode === 'analyst_picker' && <AnalystPickerView assessments={mode.assessments} onSelect={onActionCenterMode} />}
      {mode.mode === 'analyst_detail' && <AnalystDetailView assessment={mode.assessment} />}
      {mode.mode === 'assumption_challenges' && <AssumptionChallengesView riskChallenge={mode.riskChallenge} />}
      {mode.mode === 'magnitude_detail' && <MagnitudeDetailView magnitudeValidation={mode.magnitudeValidation} />}
      {mode.mode === 'stress_detail' && <StressDetailView stressTest={mode.stressTest} />}
    </aside>
  )
}

function getModeSubtitle(mode: ActionCenterMode): string {
  switch (mode.mode) {
    case 'idle': return 'Interact with cards to see details.'
    case 'holding_detail': return `Details for ${mode.ticker}`
    case 'debate_transcript': return 'Full bull/bear debate'
    case 'comparison': return 'Side-by-side comparison'
    case 'reasoning_trace': return 'Full reasoning chain'
    case 'research_brief': return 'Complete research document'
    case 'analyst_picker': return `${mode.assessments.length} analyst perspectives`
    case 'analyst_detail': return `${mode.assessment.analystType.charAt(0).toUpperCase() + mode.assessment.analystType.slice(1)} analyst assessment`
    case 'assumption_challenges': return 'Risk team assumption challenges'
    case 'magnitude_detail': return 'Historical volatility validation'
    case 'stress_detail': return 'Monte Carlo stress test results'
  }
}

// ── Idle ──────────────────────────────────────────

function IdleView() {
  return (
    <div className="action-center__idle">
      Click on holdings, debate points, or reasoning links in the chat to see detailed breakdowns here.
    </div>
  )
}

// ── Holding Detail ───────────────────────────────

function HoldingDetailView({ ticker, holdingData }: {
  readonly ticker: string
  readonly holdingData: { readonly ticker: string; readonly name: string; readonly impactMidCad: number; readonly confidence: number }
}) {
  const isNegative = holdingData.impactMidCad < 0
  return (
    <section className="action-center__section">
      <h4>Holding Impact</h4>
      <p><strong>{holdingData.name}</strong> ({ticker})</p>
      <div className={`action-center__impact ${isNegative ? 'action-center__impact--negative' : 'action-center__impact--positive'}`}>
        {isNegative ? '' : '+'}${Math.round(holdingData.impactMidCad).toLocaleString()}
      </div>
      <div className="action-center__meta">
        <span>Confidence: {Math.round(holdingData.confidence * 100)}%</span>
      </div>
    </section>
  )
}

// ── Debate Transcript ────────────────────────────

function DebateTranscriptView({ debate }: {
  readonly debate: import('@prism/shared').DebateResolution
}) {
  return (
    <>
      <section className="action-center__section">
        <h4>Debate Summary</h4>
        <div className="action-center__meta">
          <span>{debate.rounds} rounds</span>
          <span>Direction: {debate.consensusDirection}</span>
          <span>Confidence: {(debate.consensusConfidence * 100).toFixed(0)}%</span>
        </div>
      </section>

      <section className="action-center__section">
        <h4>Concessions</h4>
        <div className="action-center__debate-sides">
          <div className="action-center__debate-side action-center__debate-side--bull">
            <h5>Bull</h5>
            <ul>
              {debate.bullConcessions.length > 0
                ? debate.bullConcessions.map((c, i) => <li key={i}>{c}</li>)
                : <li className="action-center__none">None</li>
              }
            </ul>
          </div>
          <div className="action-center__debate-side action-center__debate-side--bear">
            <h5>Bear</h5>
            <ul>
              {debate.bearConcessions.length > 0
                ? debate.bearConcessions.map((c, i) => <li key={i}>{c}</li>)
                : <li className="action-center__none">None</li>
              }
            </ul>
          </div>
        </div>
      </section>

      {debate.unresolvedDisagreements.length > 0 && (
        <section className="action-center__section">
          <h4>Unresolved</h4>
          <ul className="action-center__unresolved-list">
            {debate.unresolvedDisagreements.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </section>
      )}

      {debate.debateTranscript.length > 0 && (
        <section className="action-center__section">
          <h4>Transcript</h4>
          <div className="action-center__debate-transcript">
            {debate.debateTranscript.map((arg, i) => (
              <div key={i} className="action-center__round">
                <h5>Round {arg.round} — {arg.position}</h5>
                {arg.keyPoints.length > 0 && (
                  <>
                    <strong className="action-center__round-label">Key Points</strong>
                    <ul>{arg.keyPoints.map((p, j) => <li key={j}>{p}</li>)}</ul>
                  </>
                )}
                {arg.rebuttalPoints.length > 0 && (
                  <>
                    <strong className="action-center__round-label">Rebuttals</strong>
                    <ul>{arg.rebuttalPoints.map((p, j) => <li key={j}>{p}</li>)}</ul>
                  </>
                )}
                {arg.concessions.length > 0 && (
                  <>
                    <strong className="action-center__round-label">Concessions</strong>
                    <ul>{arg.concessions.map((c, j) => <li key={j}>{c}</li>)}</ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

// ── Recommendation Comparison ────────────────────

function ComparisonView({ recommendations }: {
  readonly recommendations: readonly import('@prism/shared').Recommendation[]
}) {
  return (
    <>
      <section className="action-center__section">
        <h4>Compare Options</h4>
        <p>{recommendations.length} options available</p>
      </section>
      <div className="action-center__comparison">
        {recommendations.map((rec) => (
          <div key={rec.id} className="action-center__comparison-item">
            <h5>{rec.title}</h5>
            <p>{rec.description}</p>
            <div className="action-center__comparison-meta">
              <span>Cost: {rec.estimatedCost}</span>
              <span>Reduction: {rec.riskReduction}</span>
            </div>
            {rec.tradeoffs.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#71717A' }}>
                Tradeoffs: {rec.tradeoffs.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ── Reasoning Trace ──────────────────────────────

function ReasoningTraceView({ trace }: { readonly trace: ReasoningTraceData }) {
  return (
    <>
      <section className="action-center__section">
        <h4>Reasoning Summary</h4>
        <div className="chat-message__markdown">
          {renderMarkdown(trace.summary)}
        </div>
      </section>

      <div className="action-center__trace-grid">
        {trace.riskProfile && (
          <div className="action-center__trace-block">
            <h5>Risk Profile</h5>
            <p>{trace.riskProfile.riskTolerance} tolerance ({trace.riskProfile.riskScore}/100)</p>
          </div>
        )}
        {trace.debateResolution && (
          <div className="action-center__trace-block">
            <h5>Debate Outcome</h5>
            <p>
              {trace.debateResolution.consensusDirection} with{' '}
              {Math.round(trace.debateResolution.consensusConfidence * 100)}% confidence
            </p>
          </div>
        )}
        {trace.riskChallenge && (
          <div className="action-center__trace-block">
            <h5>Assumption Challenges</h5>
            <p>
              {trace.riskChallenge.challengedAssumptions.length} challenged,
              haircut {Math.round(trace.riskChallenge.recommendedConfidenceAdjustment * 100)}%
            </p>
          </div>
        )}
        {trace.magnitudeValidation && (
          <div className="action-center__trace-block">
            <h5>Magnitude Validation</h5>
            <p>{trace.magnitudeValidation.outOfBoundsFlags.length} out-of-bounds flags corrected</p>
          </div>
        )}
        {trace.stressTest && (
          <div className="action-center__trace-block">
            <h5>Stress Test</h5>
            <p>Tail risk midpoint: ${Math.round(trace.stressTest.tailRisk.mid).toLocaleString()}</p>
          </div>
        )}
      </div>

      {trace.steps.length > 0 && (
        <div className="action-center__chronology">
          <section className="action-center__section">
            <h4>Stage Chronology</h4>
          </section>
          <ol>
            {trace.steps.map((step) => (
              <li key={`${step.stageId}-${step.summary}`}>
                <strong>{step.stageLabel}</strong>: {step.summary}
                {step.detail && <span> ({step.detail})</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}

// ── Evidence Source Parsing ──────────────────────
// Evidence strings may be plain text, "Title — URL", or "Title: URL" format.
// Extract URLs and render as clickable links when present.

function parseEvidenceSource(source: string): { text: string; url: string | null } {
  // Match URLs anywhere in the string
  const urlMatch = source.match(/(https?:\/\/[^\s)]+)/)
  if (urlMatch) {
    const url = urlMatch[1]
    const text = source.replace(url, '').replace(/[\s—\-:]+$/, '').replace(/^[\s—\-:]+/, '').trim()
    return { text: text || url, url }
  }
  return { text: source, url: null }
}

// ── Analyst Picker ──────────────────────────────

const DIRECTION_LABEL: Readonly<Record<string, string>> = {
  positive: 'Bullish',
  negative: 'Bearish',
  neutral: 'Neutral',
  mixed: 'Mixed',
}

function AnalystPickerView({ assessments, onSelect }: {
  readonly assessments: readonly import('@prism/shared').AnalystAssessment[]
  readonly onSelect?: (mode: ActionCenterMode) => void
}) {
  return (
    <section className="action-center__section action-center__section--picker">
      <h4>Select an Analyst</h4>
      <div className="action-center__picker-list">
        {assessments.map((a) => {
          const dirClass = a.overallDirection === 'positive' ? 'positive'
            : a.overallDirection === 'negative' ? 'negative'
            : a.overallDirection === 'mixed' ? 'mixed'
            : 'neutral'
          return (
            <button
              key={a.analystType}
              type="button"
              className="action-center__picker-row"
              onClick={() => onSelect?.({ mode: 'analyst_detail', assessment: a })}
            >
              <span className="action-center__picker-name">
                {a.analystType.charAt(0).toUpperCase() + a.analystType.slice(1)}
              </span>
              <span className={`action-center__picker-direction action-center__picker-direction--${dirClass}`}>
                {DIRECTION_LABEL[a.overallDirection] ?? a.overallDirection}
              </span>
              <span className="action-center__picker-confidence">
                {Math.round(a.overallConfidence * 100)}%
              </span>
              <span className="action-center__picker-chevron" aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ── Analyst Detail ───────────────────────────────

function AnalystDetailView({ assessment }: {
  readonly assessment: import('@prism/shared').AnalystAssessment
}) {
  const directionClass = assessment.overallDirection === 'negative' ? 'negative'
    : assessment.overallDirection === 'positive' ? 'positive'
    : 'neutral'

  return (
    <>
      <section className="action-center__section">
        <h4>{assessment.analystType.charAt(0).toUpperCase() + assessment.analystType.slice(1)} Analyst</h4>
        <div className="action-center__meta">
          <span className={`action-center__direction-badge action-center__direction-badge--${directionClass}`}>
            {assessment.overallDirection}
          </span>
          <span>Confidence: {Math.round(assessment.overallConfidence * 100)}%</span>
        </div>
      </section>

      <section className="action-center__section">
        <h4>Analysis Summary</h4>
        <ul className="action-center__analyst-assumptions">
          {assessment.keyAssumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </section>

      {assessment.holdingImpacts.length > 0 && (
        <section className="action-center__section">
          <h4>Holding Impacts</h4>
          <div className="action-center__holding-impacts-table">
            <div className="action-center__table-header">
              <span>Ticker</span>
              <span>Direction</span>
              <span>Magnitude</span>
            </div>
            {assessment.holdingImpacts.map((h) => (
              <div key={h.ticker} className="action-center__table-row">
                <span className="action-center__ticker">{h.ticker}</span>
                <span className={h.direction < 0 ? 'action-center__impact--negative' : 'action-center__impact--positive'}>
                  {h.direction < 0 ? '\u2193' : h.direction > 0 ? '\u2191' : '\u2192'}
                </span>
                <span>{h.magnitudeScore.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="action-center__section">
        <h4>Reasoning</h4>
        <div className="action-center__reasoning-bullets">
          {renderMarkdown(assessment.reasoning)}
        </div>
      </section>

      {assessment.evidenceSources.length > 0 && (
        <section className="action-center__section">
          <h4>Evidence &amp; Sources</h4>
          <ul className="action-center__evidence-list">
            {assessment.evidenceSources.map((s, i) => {
              const { text, url } = parseEvidenceSource(s)
              return (
                <li key={i}>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="action-center__evidence-link">
                      {text}
                      <span className="action-center__link-icon">&rsaquo;</span>
                    </a>
                  ) : (
                    <span>{text}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}

// ── Assumption Challenges ────────────────────────

function AssumptionChallengesView({ riskChallenge }: {
  readonly riskChallenge: import('@prism/shared').RiskChallenge
}) {
  const adjPct = Math.round(riskChallenge.recommendedConfidenceAdjustment * 100)

  return (
    <>
      <section className="action-center__section">
        <h4>Overall Assessment</h4>
        <div className="chat-message__markdown">
          {renderMarkdown(riskChallenge.overallAssessment)}
        </div>
        <div className="action-center__meta" style={{ marginTop: 8 }}>
          <span className="action-center__confidence-adj-badge">
            {adjPct}% confidence adjustment
          </span>
        </div>
      </section>

      {riskChallenge.challengedAssumptions.length > 0 && (
        <section className="action-center__section">
          <h4>Challenged Assumptions</h4>
          <div className="action-center__challenge-table">
            <div className="action-center__table-header">
              <span>Analyst</span>
              <span>Assumption</span>
              <span>Likelihood Wrong</span>
            </div>
            {riskChallenge.challengedAssumptions.map((c, i) => {
              const pct = Math.round(c.likelihoodOfBeingWrong * 100)
              const level = pct >= 50 ? 'high' : pct >= 30 ? 'medium' : 'low'
              return (
                <div key={i} className="action-center__challenge-row">
                  <span className="action-center__ticker">{c.analystType.charAt(0).toUpperCase() + c.analystType.slice(1)}</span>
                  <div className="action-center__challenge-detail">
                    <span className="action-center__challenge-assumption">{c.assumption}</span>
                    <span className="action-center__challenge-counter">{c.counterEvidence}</span>
                  </div>
                  <span className={`action-center__likelihood-badge action-center__likelihood-badge--${level}`}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

// ── Magnitude Detail ─────────────────────────────

function MagnitudeDetailView({ magnitudeValidation }: {
  readonly magnitudeValidation: import('@prism/shared').MagnitudeValidation
}) {
  const flagCount = magnitudeValidation.outOfBoundsFlags.length
  const totalCount = magnitudeValidation.holdingValidations.length

  return (
    <>
      <section className="action-center__section">
        <h4>Magnitude Validation</h4>
        <div className="action-center__meta">
          <span>{totalCount} holdings validated</span>
          <span className={flagCount > 0 ? 'action-center__impact--negative' : 'action-center__impact--positive'}>
            {flagCount} out-of-bounds
          </span>
        </div>
      </section>

      <section className="action-center__section">
        <h4>Overall Assessment</h4>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary, #71717A)' }}>
          {magnitudeValidation.overallAssessment}
        </p>
      </section>

      {magnitudeValidation.holdingValidations.length > 0 && (
        <section className="action-center__section">
          <h4>Holding Validations</h4>
          <div className="action-center__holding-impacts-table">
            <div className="action-center__table-header">
              <span>Ticker</span>
              <span>Estimated</span>
              <span>Historical Vol</span>
              <span>Calibrated</span>
            </div>
            {magnitudeValidation.holdingValidations.map((h) => (
              <div
                key={h.ticker}
                className={`action-center__table-row${h.outOfBounds ? ' action-center__table-row--flagged' : ''}`}
              >
                <span className="action-center__ticker">{h.ticker}</span>
                <span>{h.estimatedMagnitude.toFixed(2)}</span>
                <span>{(h.historicalVolatility * 100).toFixed(1)}%</span>
                <span className={h.outOfBounds ? 'action-center__impact--negative' : ''}>
                  {h.calibratedMagnitude.toFixed(2)}
                  {h.outOfBounds && ' \u2193'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {flagCount > 0 && (
        <section className="action-center__section">
          <h4>Out-of-Bounds Flags</h4>
          <ul className="action-center__analyst-assumptions">
            {magnitudeValidation.outOfBoundsFlags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// ── Stress Detail ────────────────────────────────

function formatDollar(n: number): string {
  const sign = n < 0 ? '' : '+'
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`
}

function StressDetailView({ stressTest }: {
  readonly stressTest: import('@prism/shared').StressTestResult
}) {
  const scenarios = [
    { label: 'Base Case (50th)', range: stressTest.baseCase },
    { label: 'Downside (5th)', range: stressTest.downside },
    { label: 'Tail Risk (1st)', range: stressTest.tailRisk },
  ]

  return (
    <>
      <section className="action-center__section">
        <h4>Monte Carlo Simulation</h4>
        <div className="action-center__meta">
          <span>{stressTest.numSimulations.toLocaleString()} simulations</span>
          <span>{Math.round(stressTest.reversalProbability * 100)}% reversal probability</span>
        </div>
      </section>

      <section className="action-center__section">
        <h4>Scenario Summary</h4>
        <div className="action-center__stress-scenarios">
          {scenarios.map((s) => (
            <div key={s.label} className="action-center__stress-scenario">
              <span className="action-center__stress-label">{s.label}</span>
              <span className="action-center__stress-mid">{formatDollar(s.range.mid)}</span>
              <span className="action-center__stress-range">
                {formatDollar(s.range.low)} to {formatDollar(s.range.high)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {stressTest.holdingBreakdown.length > 0 && (
        <section className="action-center__section">
          <h4>Per-Holding Breakdown</h4>
          <div className="action-center__holding-impacts-table">
            <div className="action-center__table-header">
              <span>Ticker</span>
              <span>Base</span>
              <span>Downside</span>
              <span>Tail</span>
            </div>
            {stressTest.holdingBreakdown.map((h) => (
              <div key={h.ticker} className="action-center__table-row">
                <span className="action-center__ticker">{h.ticker}</span>
                <span>{formatDollar(h.baseImpact)}</span>
                <span>{formatDollar(h.downsideImpact)}</span>
                <span className="action-center__impact--negative">{formatDollar(h.tailImpact)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stressTest.scenarios.length > 0 && (
        <section className="action-center__section">
          <h4>Named Scenarios</h4>
          <ul className="action-center__analyst-assumptions">
            {stressTest.scenarios.map((s, i) => (
              <li key={i}>
                <strong>{s.name}</strong> ({s.percentile}th %ile): {s.description}
                <br />
                Impact: {formatDollar(s.portfolioImpact.low)} to {formatDollar(s.portfolioImpact.high)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// ── Research Brief ───────────────────────────────

function ResearchBriefView({ brief }: {
  readonly brief: import('@prism/shared').ResearchBrief
}) {
  return (
    <>
      <section className="action-center__section">
        <h4>Research Brief</h4>
        <div className="action-center__meta">
          <span>Quality: {(brief.qualityScore * 100).toFixed(0)}%</span>
          <span>Generated: {brief.generatedAt}</span>
        </div>
      </section>

      <div className="action-center__brief-sections">
        {brief.sections.map((section, i) => (
          <div key={i} className="action-center__brief-section">
            <h5>{section.title}</h5>
            <div className="chat-message__markdown">
              {renderMarkdown(section.content)}
            </div>
          </div>
        ))}
      </div>

      {brief.sources.length > 0 && (
        <section className="action-center__section">
          <h4>Sources</h4>
          <ul className="action-center__unresolved-list">
            {brief.sources.map((source) => (
              <li key={source.index}>
                {source.description}
                {source.url && (
                  <> — <a href={source.url} target="_blank" rel="noopener noreferrer" className="action-center__source-link">{source.url}</a></>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div style={{ fontSize: 11, color: '#71717A', padding: '8px 0', fontStyle: 'italic' }}>
        {brief.disclaimer}
      </div>
    </>
  )
}
