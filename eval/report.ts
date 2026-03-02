// Report generator — console + markdown output for 3-way evaluation results.

import type { EvalReport, EventType, JudgeScore, SystemMetrics } from './types'

function bar(fraction: number, width = 20): string {
  const filled = Math.round(fraction * width)
  const empty = width - filled
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

function pad(s: string, len: number): string {
  return s.padEnd(len)
}

function score(n: number | undefined): string {
  return n !== undefined ? n.toFixed(1) : '—'
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  rate_decision: 'Rate Decisions',
  cpi_surprise: 'CPI Surprises',
  oil_shock: 'Oil/Commodity',
  banking_stress: 'Banking Stress',
  geopolitical: 'Geopolitical',
  currency_fx: 'Currency/FX',
}

const JUDGE_DIMENSIONS: ReadonlyArray<{ key: keyof Omit<JudgeScore, 'overall'>; label: string }> = [
  { key: 'causalReasoning', label: 'Causal Reasoning' },
  { key: 'calibration', label: 'Calibration' },
  { key: 'riskIdentification', label: 'Risk Identification' },
  { key: 'recommendationQuality', label: 'Recommendation Quality' },
  { key: 'transparency', label: 'Transparency' },
]

// ── Console Report ─────────────────────────────────────────

export function generateConsoleReport(report: EvalReport): string {
  const lines: string[] = []
  const sep = '\u2550'.repeat(60)

  lines.push(sep)
  lines.push(`PRISM 3-WAY EVALUATION REPORT \u2014 ${report.eventCount} Historical Events`)
  lines.push(`Generated: ${report.timestamp}`)
  lines.push(sep)
  lines.push('')

  // Directional Accuracy
  lines.push('DIRECTIONAL ACCURACY')
  lines.push(`  Single 2.5F:  ${pad(pct(report.singleAgent.directionalAccuracy), 5)} ${bar(report.singleAgent.directionalAccuracy)}`)
  lines.push(`  Single 2.5P:  ${pad(pct(report.pro25SingleAgent.directionalAccuracy), 5)} ${bar(report.pro25SingleAgent.directionalAccuracy)}`)
  lines.push(`  Multi-agent:  ${pad(pct(report.multiAgent.directionalAccuracy), 5)} ${bar(report.multiAgent.directionalAccuracy)}`)
  lines.push('')

  // Range Coverage
  lines.push('CONFIDENCE RANGE COVERAGE')
  lines.push(`  Single 2.5F:  ${pad(pct(report.singleAgent.rangeCoverage), 5)} ${bar(report.singleAgent.rangeCoverage)}`)
  lines.push(`  Single 2.5P:  ${pad(pct(report.pro25SingleAgent.rangeCoverage), 5)} ${bar(report.pro25SingleAgent.rangeCoverage)}`)
  lines.push(`  Multi-agent:  ${pad(pct(report.multiAgent.rangeCoverage), 5)} ${bar(report.multiAgent.rangeCoverage)}`)
  lines.push('')

  // Evidence Grounding
  lines.push('EVIDENCE GROUNDING')
  lines.push(`  Multi-agent:  ${pad(pct(report.multiAgent.evidenceGrounding), 5)} ${bar(report.multiAgent.evidenceGrounding)}`)
  lines.push('')

  // Judge Quality Scores
  const maJudge = report.multiAgent.averageJudgeScore
  const saJudge = report.singleAgent.averageJudgeScore
  const proJudge = report.pro25SingleAgent.averageJudgeScore

  if (maJudge ?? saJudge ?? proJudge) {
    lines.push('QUALITY SCORES (LLM-as-Judge, 0-5)')
    lines.push(`  ${'Metric'.padEnd(24)} Single 2.5  Single 2.5P  Multi-Agent`)
    lines.push(`  ${'\u2500'.repeat(24)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(10)}`)
    for (const { key, label } of JUDGE_DIMENSIONS) {
      lines.push(
        `  ${label.padEnd(24)} ${score(saJudge?.[key]).padEnd(10)} ${score(proJudge?.[key]).padEnd(10)} ${score(maJudge?.[key])}`,
      )
    }
    lines.push(
      `  ${'Overall'.padEnd(24)} ${score(saJudge?.overall).padEnd(10)} ${score(proJudge?.overall).padEnd(10)} ${score(maJudge?.overall)}`,
    )
    lines.push('')
  }

  // Per Event Type
  lines.push('BY EVENT TYPE (Multi-Agent)')
  for (const [type, label] of Object.entries(EVENT_TYPE_LABELS)) {
    const metrics = report.multiAgent.perEventType.get(type as EventType)
    if (metrics) {
      lines.push(`  ${pad(label + ':', 20)} ${pad(pct(metrics.accuracy), 5)} accuracy, ${pct(metrics.coverage)} coverage`)
    }
  }
  lines.push('')
  lines.push(sep)

  return lines.join('\n')
}

// ── Markdown Report ────────────────────────────────────────

export function generateMarkdownReport(report: EvalReport): string {
  const lines: string[] = []

  lines.push('# Prism 3-Way Evaluation Report')
  lines.push('')
  lines.push(`**Events:** ${report.eventCount} | **Generated:** ${report.timestamp}`)
  lines.push('')
  lines.push('**Narrative:** Single Gemini 2.5 Flash → Single Gemini 2.5 Pro → Multi-agent Gemini 2.5 Flash')
  lines.push('')

  // Summary Table
  lines.push('## Summary')
  lines.push('')
  lines.push('| Metric | Single 2.5 Flash | Single 2.5 Pro | Multi-Agent | Delta (MA vs 2.5 Pro) |')
  lines.push('|--------|-----------------|---------------|-------------|----------------------|')

  const dAcc25 = report.multiAgent.directionalAccuracy - report.singleAgent.directionalAccuracy
  const dAccPro = report.multiAgent.directionalAccuracy - report.pro25SingleAgent.directionalAccuracy
  const dCovPro = report.multiAgent.rangeCoverage - report.pro25SingleAgent.rangeCoverage

  lines.push(
    `| Directional Accuracy | ${pct(report.singleAgent.directionalAccuracy)} | ${pct(report.pro25SingleAgent.directionalAccuracy)} | ${pct(report.multiAgent.directionalAccuracy)} | ${dAccPro >= 0 ? '+' : ''}${pct(dAccPro)} |`,
  )
  lines.push(
    `| Range Coverage | ${pct(report.singleAgent.rangeCoverage)} | ${pct(report.pro25SingleAgent.rangeCoverage)} | ${pct(report.multiAgent.rangeCoverage)} | ${dCovPro >= 0 ? '+' : ''}${pct(dCovPro)} |`,
  )
  lines.push(`| Evidence Grounding | N/A | N/A | ${pct(report.multiAgent.evidenceGrounding)} | — |`)
  lines.push('')

  // Quality Score Table
  const maJudge = report.multiAgent.averageJudgeScore
  const saJudge = report.singleAgent.averageJudgeScore
  const proJudge = report.pro25SingleAgent.averageJudgeScore

  if (maJudge ?? saJudge ?? proJudge) {
    lines.push('## Quality Scores (LLM-as-Judge)')
    lines.push('')
    lines.push('Scored 0-5 by Gemini 3 Flash. Higher is better.')
    lines.push('')
    lines.push('| Metric | Single 2.5F | Single 2.5P | Multi-Agent |')
    lines.push('|--------|------------|------------|-------------|')
    for (const { key, label } of JUDGE_DIMENSIONS) {
      lines.push(`| ${label} | ${score(saJudge?.[key])} | ${score(proJudge?.[key])} | ${score(maJudge?.[key])} |`)
    }
    lines.push(`| **Overall** | **${score(saJudge?.overall)}** | **${score(proJudge?.overall)}** | **${score(maJudge?.overall)}** |`)
    lines.push('')
  }

  // Per Event Type
  lines.push('## By Event Type')
  lines.push('')
  lines.push('| Event Type | Single 2.5 Acc | Single 2.5P Acc | Multi-Agent Acc | Multi-Agent Cov |')
  lines.push('|------------|---------------|---------------|----------------|----------------|')

  for (const [type, label] of Object.entries(EVENT_TYPE_LABELS)) {
    const ma = report.multiAgent.perEventType.get(type as EventType)
    const sa = report.singleAgent.perEventType.get(type as EventType)
    const f3 = report.pro25SingleAgent.perEventType.get(type as EventType)
    if (ma && sa && f3) {
      lines.push(`| ${label} | ${pct(sa.accuracy)} | ${pct(f3.accuracy)} | ${pct(ma.accuracy)} | ${pct(ma.coverage)} |`)
    }
  }

  lines.push('')

  // Per-Event Detail
  lines.push('## Per-Event Results')
  lines.push('')
  lines.push('| Event | Type | Single 2.5 | Single 2.5P | Multi-Agent | Actual |')
  lines.push('|-------|------|-----------|-----------|-------------|--------|')

  for (const result of report.results) {
    lines.push(
      `| ${result.eventId} | ${result.eventType} | ${result.singleAgent.direction} | ${result.pro25SingleAgent.direction} | ${result.multiAgent.direction} | ${result.actual.netDirection} |`,
    )
  }

  lines.push('')
  lines.push('---')
  lines.push('*Generated by Prism Evaluation Harness*')

  return lines.join('\n')
}
