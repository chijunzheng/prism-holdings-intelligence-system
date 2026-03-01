// ActionCenter — mode-based contextual detail panel.
// Responds to card interactions: shows holding details, debate transcripts,
// recommendation comparisons, reasoning traces, or research briefs.

import type { ActionCenterMode, ReasoningTraceData } from '../chat-cards/types'
import { renderMarkdown } from '../chat/render-markdown'

interface ActionCenterProps {
  readonly mode: ActionCenterMode
  readonly onClose: () => void
}

export function ActionCenter({ mode, onClose }: ActionCenterProps) {
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
          &times;
        </button>
      </div>

      {mode.mode === 'idle' && <IdleView />}
      {mode.mode === 'holding_detail' && <HoldingDetailView ticker={mode.ticker} holdingData={mode.holdingData} />}
      {mode.mode === 'debate_transcript' && <DebateTranscriptView debate={mode.debate} />}
      {mode.mode === 'comparison' && <ComparisonView recommendations={mode.recommendations} />}
      {mode.mode === 'reasoning_trace' && <ReasoningTraceView trace={mode.trace} />}
      {mode.mode === 'research_brief' && <ResearchBriefView brief={mode.brief} />}
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

      <div className="action-center__debate-sides">
        <div className="action-center__debate-side action-center__debate-side--bull">
          <h5>Bull Concessions</h5>
          <ul>
            {debate.bullConcessions.length > 0
              ? debate.bullConcessions.map((c, i) => <li key={i}>{c}</li>)
              : <li>None</li>
            }
          </ul>
        </div>
        <div className="action-center__debate-side action-center__debate-side--bear">
          <h5>Bear Concessions</h5>
          <ul>
            {debate.bearConcessions.length > 0
              ? debate.bearConcessions.map((c, i) => <li key={i}>{c}</li>)
              : <li>None</li>
            }
          </ul>
        </div>
      </div>

      {debate.unresolvedDisagreements.length > 0 && (
        <section className="action-center__section">
          <h4>Unresolved</h4>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
            {debate.unresolvedDisagreements.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </section>
      )}

      {debate.debateTranscript.length > 0 && (
        <div className="action-center__debate-transcript">
          {debate.debateTranscript.map((arg, i) => (
            <div key={i} className="action-center__round">
              <h5>Round {arg.round} — {arg.position}</h5>
              {arg.keyPoints.length > 0 && (
                <>
                  <strong style={{ fontSize: 11, color: '#71717A' }}>Key Points</strong>
                  <ul>{arg.keyPoints.map((p, j) => <li key={j}>{p}</li>)}</ul>
                </>
              )}
              {arg.rebuttalPoints.length > 0 && (
                <>
                  <strong style={{ fontSize: 11, color: '#71717A' }}>Rebuttals</strong>
                  <ul>{arg.rebuttalPoints.map((p, j) => <li key={j}>{p}</li>)}</ul>
                </>
              )}
              {arg.concessions.length > 0 && (
                <>
                  <strong style={{ fontSize: 11, color: '#71717A' }}>Concessions</strong>
                  <ul>{arg.concessions.map((c, j) => <li key={j}>{c}</li>)}</ul>
                </>
              )}
            </div>
          ))}
        </div>
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
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
            {brief.sources.map((source) => (
              <li key={source.index}>
                {source.description}
                {source.url && (
                  <> — <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>{source.url}</a></>
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
