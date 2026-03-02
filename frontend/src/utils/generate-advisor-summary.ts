// generate-advisor-summary.ts — multi-page report for advisor handoff.
// Uses window.print() to produce PDF via the browser's native print dialog.
// Page 1: Executive summary. Page 2: Holding impact detail.
// Page 3: Analysis detail (analysts, debate, risk). Page 4: Research brief.

import type { Recommendation, RecommendationAction } from '@prism/shared'
import type { AnalysisReportData } from '../components/chat-cards/types'

function formatDollar(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString()}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeHref(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '#'
    return escapeHtml(url)
  } catch {
    return '#'
  }
}

/** Convert markdown text to simple HTML for PDF rendering. */
function mdToHtml(md: string): string {
  return escapeHtml(md)
    // Headers: ### Title → <h4>Title</h4> etc.
    .replace(/^#### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Bold: **text** → <strong>text</strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* → <em>text</em>
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists: - item → <li>item</li>
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Numbered lists: 1. item → <li>item</li>
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Paragraphs: blank-line separated text
    .replace(/\n\n+/g, '</p><p>')
    // Single newlines (within paragraphs)
    .replace(/\n/g, '<br>')
    // Wrap in paragraph
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    // Clean up empty paragraphs
    .replace(/<p>\s*<\/p>/g, '')
    // Clean up p tags around block elements
    .replace(/<p>(<h[2-5]>)/g, '$1')
    .replace(/(<\/h[2-5]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1')
}

function directionLabel(d: number): string {
  if (d < -0.2) return 'Bearish'
  if (d > 0.2) return 'Bullish'
  return 'Neutral'
}

const PRINT_STYLES = `
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page-break { page-break-before: always; }
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 680px;
  margin: 0 auto;
  padding: 32px 24px;
  color: #1a1a1a;
  font-size: 13px;
  line-height: 1.5;
}
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 16px; margin: 20px 0 8px; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; }
h3 { font-size: 14px; margin: 14px 0 6px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
th, td { padding: 4px 8px; text-align: left; font-size: 13px; }
th { font-weight: 600; border-bottom: 2px solid #E5E7EB; color: #71717A; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
td { border-bottom: 1px solid #F3F4F6; }
hr { border: none; border-top: 1px solid #E5E7EB; margin: 16px 0; }
.subtitle { font-size: 13px; color: #71717A; margin: 0 0 16px; }
.impact-neg { color: #DC2626; }
.impact-pos { color: #16A34A; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
.badge-red { background: #FEE2E2; color: #991B1B; }
.badge-green { background: #DCFCE7; color: #166534; }
.badge-neutral { background: #F3F4F6; color: #374151; }
.meta-row { display: flex; gap: 12px; margin-bottom: 12px; font-size: 13px; }
.meta-row span { color: #484848; }
.rec-card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
.rec-card--baseline { border-style: dashed; }
.rec-meta { font-size: 12px; color: #71717A; margin-top: 4px; }
.section-block { margin-bottom: 16px; }
.section-block h3 { color: #374151; }
.section-block p { margin: 4px 0; color: #484848; }
.disclaimer { font-size: 11px; color: #a1a1aa; margin-top: 16px; line-height: 1.4; font-style: italic; }
a { color: #2563EB; text-decoration: none; }
a:hover { text-decoration: underline; }
ol, ul { padding-left: 20px; margin: 4px 0 8px; }
li { margin-bottom: 4px; }
`

// ── Page 1: Executive Summary ────────────────────────────────

function buildPage1(report: AnalysisReportData): string {
  const { signal, verdict, impactDelta } = report
  const netImpact = impactDelta.netImpactMidCad
  const date = new Date().toISOString().slice(0, 10)

  const avgDirection = verdict.holdingImpacts.length > 0
    ? verdict.holdingImpacts.reduce((s, h) => s + h.direction, 0) / verdict.holdingImpacts.length
    : 0
  const top5 = impactDelta.affectedHoldings.slice(0, 5)
  const holdingsRows = top5
    .map((h) =>
      `<tr>
        <td style="font-weight:600">${escapeHtml(h.ticker)}</td>
        <td>${escapeHtml(h.name)}</td>
        <td style="text-align:right" class="${h.impactMidCad < 0 ? 'impact-neg' : 'impact-pos'}">${formatDollar(h.impactMidCad)}</td>
      </tr>`,
    )
    .join('\n')

  const moreNote = impactDelta.affectedHoldings.length > 5
    ? `<p style="color:#71717A;font-size:12px">+${impactDelta.affectedHoldings.length - 5} more holdings (see page 2)</p>`
    : ''

  const recsHtml = verdict.recommendations
    .map((rec) => {
      const baseline = rec.isDoNothing ? ' <span style="color:#71717A">(baseline)</span>' : ''
      return `<div class="rec-card${rec.isDoNothing ? ' rec-card--baseline' : ''}">
        <strong>${escapeHtml(rec.title)}${baseline}</strong>
        <p style="margin:4px 0;color:#484848">${escapeHtml(rec.description)}</p>
        <div class="rec-meta">Cost: ${escapeHtml(rec.estimatedCost)} &middot; Risk: ${escapeHtml(rec.riskReduction)}</div>
      </div>`
    })
    .join('\n')

  const debateLine = report.intermediateArtifacts?.debateResolution
    ? `<p style="font-size:13px;color:#484848">Consensus: <strong>${escapeHtml(report.intermediateArtifacts.debateResolution.consensusDirection)}</strong> after ${report.intermediateArtifacts.debateResolution.rounds} rounds &middot; ${Math.round(report.intermediateArtifacts.debateResolution.consensusConfidence * 100)}% confidence</p>`
    : ''

  return `
<h1>Signal Analysis Summary</h1>
<p class="subtitle">Generated by Prism Intelligence on ${date}</p>

<table style="margin-bottom:16px">
  <tr><td style="color:#71717A;width:120px">Signal</td><td style="font-weight:600">${escapeHtml(signal.headline)}</td></tr>
  <tr><td style="color:#71717A">1-Month Impact</td><td style="font-weight:600" class="${netImpact < 0 ? 'impact-neg' : 'impact-pos'}">${formatDollar(netImpact)}</td></tr>
  <tr><td style="color:#71717A">Direction</td><td><span class="badge ${avgDirection < -0.2 ? 'badge-red' : avgDirection > 0.2 ? 'badge-green' : 'badge-neutral'}">${directionLabel(avgDirection)}</span></td></tr>
  <tr><td style="color:#71717A">Quality Score</td><td>${report.qualityScore}%</td></tr>
  <tr><td style="color:#71717A">Agents Used</td><td>${report.agentCount}</td></tr>
</table>

<hr>

<h2>Top Affected Holdings</h2>
<table>
  <thead><tr><th>Ticker</th><th>Name</th><th style="text-align:right">1M Impact</th></tr></thead>
  <tbody>${holdingsRows}</tbody>
</table>
${moreNote}

<hr>

<h2>Recommendations</h2>
${recsHtml}

${debateLine}

<p class="disclaimer">
This analysis is for informational purposes only. Past performance does not guarantee future results.
Consult a qualified financial advisor before making investment decisions.
</p>`
}

// ── Page 2: Holding Impact Detail ────────────────────────────

function buildPage2(report: AnalysisReportData): string {
  const { verdict, impactDelta } = report

  const allHoldingsRows = impactDelta.affectedHoldings
    .map((h) => {
      // Find matching calibrated holding for multi-horizon data
      const cal = verdict.holdingImpacts.find((c) => c.ticker === h.ticker)
      const m1 = cal?.impact?.['1M']
      const m6 = cal?.impact?.['6M']
      return `<tr>
        <td style="font-weight:600">${escapeHtml(h.ticker)}</td>
        <td>${escapeHtml(h.name)}</td>
        <td style="text-align:right">${cal?.holdingValueCad != null ? `$${Math.round(cal.holdingValueCad).toLocaleString()}` : '—'}</td>
        <td style="text-align:right" class="${h.impactMidCad < 0 ? 'impact-neg' : 'impact-pos'}">${m1 ? `${formatDollar(m1.low)} to ${formatDollar(m1.high)}` : formatDollar(h.impactMidCad)}</td>
        <td style="text-align:right">${m6 ? `${formatDollar(m6.low)} to ${formatDollar(m6.high)}` : '—'}</td>
      </tr>`
    })
    .join('\n')

  const totalImpact = impactDelta.netImpactMidCad

  // Per-recommendation action tables
  const recActionTables = verdict.recommendations
    .filter((rec): rec is Recommendation & { actions: RecommendationAction[] } =>
      Array.isArray(rec.actions) && rec.actions.length > 0,
    )
    .map((rec) => {
      const rows = rec.actions
        .map((act) =>
          `<tr>
            <td style="font-weight:600">${escapeHtml(act.ticker)}</td>
            <td>${escapeHtml(act.name)}</td>
            <td style="color:${act.action === 'reduce' || act.action === 'remove' ? '#DC2626' : act.action === 'hold' ? '#71717A' : '#16A34A'}">${act.action}</td>
            <td style="text-align:right">${act.suggestedChangeCad != null ? formatDollar(act.suggestedChangeCad) : '—'}</td>
            <td style="font-size:12px;color:#484848">${escapeHtml(act.rationale)}</td>
          </tr>`,
        )
        .join('\n')
      return `
      <h3>${escapeHtml(rec.title)}</h3>
      <table>
        <thead><tr><th>Ticker</th><th>Name</th><th>Action</th><th style="text-align:right">Amount</th><th>Rationale</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    })
    .join('\n')

  return `
<div class="page-break"></div>
<h1>Holding Impact Detail</h1>

<h2>All Holdings</h2>
<table>
  <thead><tr><th>Ticker</th><th>Name</th><th style="text-align:right">Value</th><th style="text-align:right">1M Range</th><th style="text-align:right">6M Range</th></tr></thead>
  <tbody>
    ${allHoldingsRows}
    <tr style="border-top:2px solid #E5E7EB;font-weight:600">
      <td colspan="3">Total Net Impact</td>
      <td style="text-align:right" class="${totalImpact < 0 ? 'impact-neg' : 'impact-pos'}">${formatDollar(totalImpact)}</td>
      <td></td>
    </tr>
  </tbody>
</table>

${recActionTables ? `<h2>Recommendation Action Plans</h2>${recActionTables}` : ''}`
}

// ── Page 3: Analysis Detail ──────────────────────────────────

function buildPage3(report: AnalysisReportData): string {
  const artifacts = report.intermediateArtifacts
  if (!artifacts) return ''

  // Analyst perspectives
  const analystHtml = artifacts.analystAssessments
    .map((a) => {
      const dir = a.overallDirection === 'negative' ? 'Bearish'
        : a.overallDirection === 'positive' ? 'Bullish'
        : a.overallDirection === 'mixed' ? 'Mixed' : 'Neutral'
      const conf = Math.round(a.overallConfidence * 100)
      const assumptions = a.keyAssumptions.map((k) => `<li>${escapeHtml(k)}</li>`).join('')
      return `<div class="section-block">
        <h3>${escapeHtml(a.analystType.charAt(0).toUpperCase() + a.analystType.slice(1))} Analyst</h3>
        <p><span class="badge ${a.overallDirection === 'negative' ? 'badge-red' : a.overallDirection === 'positive' ? 'badge-green' : 'badge-neutral'}">${dir}</span> &middot; ${conf}% confidence</p>
        <p><strong>Key Assumptions:</strong></p>
        <ul>${assumptions}</ul>
        <div class="section-block">${mdToHtml(a.reasoning)}</div>
      </div>`
    })
    .join('\n')

  // Debate
  const debate = artifacts.debateResolution
  const bullConcessions = debate.bullConcessions.map((c) => `<li>${escapeHtml(c)}</li>`).join('')
  const bearConcessions = debate.bearConcessions.map((c) => `<li>${escapeHtml(c)}</li>`).join('')
  const unresolved = debate.unresolvedDisagreements.map((d) => `<li>${escapeHtml(d)}</li>`).join('')

  const debateHtml = `<div class="section-block">
    <p>Direction: <strong>${escapeHtml(debate.consensusDirection)}</strong> &middot; Confidence: ${Math.round(debate.consensusConfidence * 100)}% &middot; ${debate.rounds} rounds</p>
    ${bullConcessions ? `<p><strong>Bull Concessions:</strong></p><ul>${bullConcessions}</ul>` : ''}
    ${bearConcessions ? `<p><strong>Bear Concessions:</strong></p><ul>${bearConcessions}</ul>` : ''}
    ${unresolved ? `<p><strong>Unresolved Disagreements:</strong></p><ul>${unresolved}</ul>` : ''}
  </div>`

  // Risk challenges
  const riskHtml = artifacts.riskChallenge.challengedAssumptions
    .map((c) => {
      const pct = Math.round(c.likelihoodOfBeingWrong * 100)
      return `<tr>
        <td>${escapeHtml(c.analystType)}</td>
        <td>${escapeHtml(c.assumption)}</td>
        <td>${escapeHtml(c.counterEvidence)}</td>
        <td style="text-align:right">${pct}%</td>
      </tr>`
    })
    .join('\n')

  return `
<div class="page-break"></div>
<h1>Analysis Detail</h1>

<h2>Analyst Perspectives</h2>
${analystHtml}

<h2>Debate Summary</h2>
${debateHtml}

<h2>Risk Challenges</h2>
<div style="color:#484848">${mdToHtml(artifacts.riskChallenge.overallAssessment)}</div>
<p>Confidence adjustment: ${Math.round(artifacts.riskChallenge.recommendedConfidenceAdjustment * 100)}%</p>
${riskHtml ? `<table>
  <thead><tr><th>Analyst</th><th>Assumption</th><th>Counter-Evidence</th><th style="text-align:right">Likelihood Wrong</th></tr></thead>
  <tbody>${riskHtml}</tbody>
</table>` : ''}`
}

// ── Page 4: Research Brief ───────────────────────────────────

function buildPage4(report: AnalysisReportData): string {
  const brief = report.researchBrief
  if (!brief) return ''

  const sectionsHtml = brief.sections
    .map((s, i) => {
      return `<div class="section-block">
        <h3>${i + 1}. ${escapeHtml(s.title)}</h3>
        ${mdToHtml(s.content)}
      </div>`
    })
    .join('\n')

  const sourcesHtml = brief.sources
    .map((s) => {
      const link = s.url ? `<a href="${safeHref(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.description)}</a>` : escapeHtml(s.description)
      return `<li>${link}</li>`
    })
    .join('\n')

  return `
<div class="page-break"></div>
<h1>Research Brief</h1>
<p class="subtitle">Quality: ${Math.round(brief.qualityScore * 100)}%</p>

${sectionsHtml}

${sourcesHtml ? `<h2>Sources</h2><ol>${sourcesHtml}</ol>` : ''}

<p class="disclaimer">${escapeHtml(brief.disclaimer)}</p>`
}

// ── Main export ──────────────────────────────────────────────

export function generateAdvisorHtml(report: AnalysisReportData): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signal Analysis Summary</title>
<style>${PRINT_STYLES}</style></head><body>
${buildPage1(report)}
${buildPage2(report)}
${buildPage3(report)}
${buildPage4(report)}
</body></html>`
}

export function downloadAdvisorPdf(report: AnalysisReportData): boolean {
  const html = generateAdvisorHtml(report)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const printWindow = window.open(url, '_blank')
  if (!printWindow) {
    URL.revokeObjectURL(url)
    return false
  }
  printWindow.addEventListener('load', () => {
    printWindow.print()
    URL.revokeObjectURL(url)
  })
  return true
}

// Keep backward-compatible export for any existing callers
export const downloadAdvisorSummary = downloadAdvisorPdf
