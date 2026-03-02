// Report generator — console + markdown output for 4-way evaluation results.
// Tier 1: Fair head-to-head (all 4 systems) — directional accuracy, causal reasoning, risk ID, transparency.
// Tier 2: Prism structural capabilities (3 systems) — range coverage, calibration, recommendations.

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
  return n !== undefined ? n.toFixed(1) : '\u2014'
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  rate_decision: 'Rate Decisions',
  cpi_surprise: 'CPI Surprises',
  oil_shock: 'Oil/Commodity',
  banking_stress: 'Banking Stress',
  geopolitical: 'Geopolitical',
  currency_fx: 'Currency/FX',
}

/** Tier 1 dimensions — fair comparison across all 4 systems */
const TIER1_DIMENSIONS: ReadonlyArray<{ key: keyof Omit<JudgeScore, 'overall'>; label: string }> = [
  { key: 'causalReasoning', label: 'Causal Reasoning' },
  { key: 'riskIdentification', label: 'Risk Identification' },
  { key: 'transparency', label: 'Transparency' },
]

/** Tier 2 dimensions — Prism structural capabilities (TradingAgents N/A) */
const TIER2_DIMENSIONS: ReadonlyArray<{ key: keyof Omit<JudgeScore, 'overall'>; label: string }> = [
  { key: 'calibration', label: 'Calibration' },
  { key: 'recommendationQuality', label: 'Recommendation Quality' },
]

// ── Console Report ─────────────────────────────────────────

export function generateConsoleReport(report: EvalReport): string {
  const lines: string[] = []
  const sep = '\u2550'.repeat(70)

  lines.push(sep)
  lines.push(`PRISM 4-WAY EVALUATION REPORT \u2014 ${report.eventCount} Historical Events`)
  lines.push(`Generated: ${report.timestamp}`)
  lines.push(sep)
  lines.push('')

  // Directional Accuracy
  lines.push('DIRECTIONAL ACCURACY')
  lines.push(`  Single 2.5F:    ${pad(pct(report.singleAgent.directionalAccuracy), 5)} ${bar(report.singleAgent.directionalAccuracy)}`)
  lines.push(`  Single 2.5P:    ${pad(pct(report.pro25SingleAgent.directionalAccuracy), 5)} ${bar(report.pro25SingleAgent.directionalAccuracy)}`)
  lines.push(`  TradingAgents:  ${pad(pct(report.tradingAgents.directionalAccuracy), 5)} ${bar(report.tradingAgents.directionalAccuracy)}`)
  lines.push(`  Multi-agent:    ${pad(pct(report.multiAgent.directionalAccuracy), 5)} ${bar(report.multiAgent.directionalAccuracy)}`)
  lines.push('')

  // Range Coverage (Tier 2 — TradingAgents N/A)
  lines.push('CONFIDENCE RANGE COVERAGE (Tier 2 — TradingAgents N/A)')
  lines.push(`  Single 2.5F:    ${pad(pct(report.singleAgent.rangeCoverage), 5)} ${bar(report.singleAgent.rangeCoverage)}`)
  lines.push(`  Single 2.5P:    ${pad(pct(report.pro25SingleAgent.rangeCoverage), 5)} ${bar(report.pro25SingleAgent.rangeCoverage)}`)
  lines.push(`  Multi-agent:    ${pad(pct(report.multiAgent.rangeCoverage), 5)} ${bar(report.multiAgent.rangeCoverage)}`)
  lines.push('')

  // Evidence Grounding
  lines.push('EVIDENCE GROUNDING')
  lines.push(`  Multi-agent:    ${pad(pct(report.multiAgent.evidenceGrounding), 5)} ${bar(report.multiAgent.evidenceGrounding)}`)
  lines.push('')

  // Judge Quality Scores
  const maJudge = report.multiAgent.averageJudgeScore
  const saJudge = report.singleAgent.averageJudgeScore
  const proJudge = report.pro25SingleAgent.averageJudgeScore
  const taJudge = report.tradingAgents.averageJudgeScore

  if (maJudge ?? saJudge ?? proJudge ?? taJudge) {
    // Tier 1 — all 4 systems
    lines.push('TIER 1: QUALITY SCORES — Head-to-Head (0-5)')
    lines.push(`  ${'Metric'.padEnd(24)} Single 2.5  Single 2.5P  TradingAg   Multi-Agent`)
    lines.push(`  ${'\u2500'.repeat(24)} ${'─'.repeat(10)} ${'─'.repeat(11)} ${'─'.repeat(10)} ${'─'.repeat(10)}`)
    for (const { key, label } of TIER1_DIMENSIONS) {
      lines.push(
        `  ${label.padEnd(24)} ${score(saJudge?.[key]).padEnd(10)} ${score(proJudge?.[key]).padEnd(12)} ${score(taJudge?.[key]).padEnd(10)} ${score(maJudge?.[key])}`,
      )
    }
    lines.push('')

    // Tier 2 — 3 systems (TradingAgents N/A)
    lines.push('TIER 2: QUALITY SCORES — Prism Structural Advantage (0-5)')
    lines.push(`  ${'Metric'.padEnd(24)} Single 2.5  Single 2.5P  Multi-Agent  TradingAg`)
    lines.push(`  ${'\u2500'.repeat(24)} ${'─'.repeat(10)} ${'─'.repeat(11)} ${'─'.repeat(11)} ${'─'.repeat(10)}`)
    for (const { key, label } of TIER2_DIMENSIONS) {
      lines.push(
        `  ${label.padEnd(24)} ${score(saJudge?.[key]).padEnd(10)} ${score(proJudge?.[key]).padEnd(12)} ${score(maJudge?.[key]).padEnd(11)} N/A`,
      )
    }
    lines.push('')

    // Overall
    lines.push('OVERALL JUDGE SCORES (0-5)')
    lines.push(`  Single 2.5F:    ${score(saJudge?.overall)}`)
    lines.push(`  Single 2.5P:    ${score(proJudge?.overall)}`)
    lines.push(`  TradingAgents:  ${score(taJudge?.overall)}`)
    lines.push(`  Multi-agent:    ${score(maJudge?.overall)}`)
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

  lines.push('# Prism 4-Way Evaluation Report')
  lines.push('')
  lines.push(`**Events:** ${report.eventCount} | **Generated:** ${report.timestamp}`)
  lines.push('')
  lines.push('**Systems:** Single Gemini 2.5 Flash | Single Gemini 2.5 Pro | TradingAgents (Gemini 2.5 Flash) | Prism Multi-Agent (Gemini 2.5 Flash)')
  lines.push('')

  // Summary Table
  lines.push('## Summary')
  lines.push('')
  lines.push('| Metric | Single 2.5 Flash | Single 2.5 Pro | TradingAgents | Multi-Agent | Delta (MA vs Best) |')
  lines.push('|--------|-----------------|---------------|--------------|-------------|-------------------|')

  const bestDirAcc = Math.max(
    report.singleAgent.directionalAccuracy,
    report.pro25SingleAgent.directionalAccuracy,
    report.tradingAgents.directionalAccuracy,
  )
  const dAccBest = report.multiAgent.directionalAccuracy - bestDirAcc
  const dCovPro = report.multiAgent.rangeCoverage - report.pro25SingleAgent.rangeCoverage

  lines.push(
    `| Directional Accuracy | ${pct(report.singleAgent.directionalAccuracy)} | ${pct(report.pro25SingleAgent.directionalAccuracy)} | ${pct(report.tradingAgents.directionalAccuracy)} | ${pct(report.multiAgent.directionalAccuracy)} | ${dAccBest >= 0 ? '+' : ''}${pct(dAccBest)} |`,
  )
  lines.push(
    `| Range Coverage | ${pct(report.singleAgent.rangeCoverage)} | ${pct(report.pro25SingleAgent.rangeCoverage)} | N/A | ${pct(report.multiAgent.rangeCoverage)} | ${dCovPro >= 0 ? '+' : ''}${pct(dCovPro)} |`,
  )
  lines.push(`| Evidence Grounding | N/A | N/A | N/A | ${pct(report.multiAgent.evidenceGrounding)} | \u2014 |`)
  lines.push('')

  // Tier 1: Quality Scores — Head-to-Head
  const maJudge = report.multiAgent.averageJudgeScore
  const saJudge = report.singleAgent.averageJudgeScore
  const proJudge = report.pro25SingleAgent.averageJudgeScore
  const taJudge = report.tradingAgents.averageJudgeScore

  if (maJudge ?? saJudge ?? proJudge ?? taJudge) {
    lines.push('## Tier 1: Quality Scores — Head-to-Head (All 4 Systems)')
    lines.push('')
    lines.push('Scored 0-5 by Gemini 3 Flash. Higher is better.')
    lines.push('')
    lines.push('| Metric | Single 2.5F | Single 2.5P | TradingAgents | Multi-Agent |')
    lines.push('|--------|------------|------------|--------------|-------------|')
    for (const { key, label } of TIER1_DIMENSIONS) {
      lines.push(`| ${label} | ${score(saJudge?.[key])} | ${score(proJudge?.[key])} | ${score(taJudge?.[key])} | ${score(maJudge?.[key])} |`)
    }
    lines.push('')

    // Tier 2: Prism Structural Advantage
    lines.push('## Tier 2: Prism Structural Advantage (TradingAgents N/A)')
    lines.push('')
    lines.push('TradingAgents produces BUY/SELL/HOLD without dollar estimates or portfolio-level recommendations.')
    lines.push('')
    lines.push('| Metric | Single 2.5F | Single 2.5P | Multi-Agent | TradingAgents |')
    lines.push('|--------|------------|------------|-------------|--------------|')
    for (const { key, label } of TIER2_DIMENSIONS) {
      lines.push(`| ${label} | ${score(saJudge?.[key])} | ${score(proJudge?.[key])} | ${score(maJudge?.[key])} | N/A |`)
    }
    lines.push(`| Range Coverage | ${pct(report.singleAgent.rangeCoverage)} | ${pct(report.pro25SingleAgent.rangeCoverage)} | ${pct(report.multiAgent.rangeCoverage)} | N/A |`)
    lines.push('')

    // Overall scores
    lines.push('## Overall Judge Scores')
    lines.push('')
    lines.push('| System | Overall (0-5) |')
    lines.push('|--------|--------------|')
    lines.push(`| Single 2.5 Flash | **${score(saJudge?.overall)}** |`)
    lines.push(`| Single 2.5 Pro | **${score(proJudge?.overall)}** |`)
    lines.push(`| TradingAgents | **${score(taJudge?.overall)}** |`)
    lines.push(`| Prism Multi-Agent | **${score(maJudge?.overall)}** |`)
    lines.push('')
  }

  // Per Event Type
  lines.push('## By Event Type')
  lines.push('')
  lines.push('| Event Type | Single 2.5 Acc | Single 2.5P Acc | TradingAgents Acc | Multi-Agent Acc | Multi-Agent Cov |')
  lines.push('|------------|---------------|---------------|--------------------|----------------|----------------|')

  for (const [type, label] of Object.entries(EVENT_TYPE_LABELS)) {
    const ma = report.multiAgent.perEventType.get(type as EventType)
    const sa = report.singleAgent.perEventType.get(type as EventType)
    const f3 = report.pro25SingleAgent.perEventType.get(type as EventType)
    const ta = report.tradingAgents.perEventType.get(type as EventType)
    if (ma && sa && f3) {
      lines.push(`| ${label} | ${pct(sa.accuracy)} | ${pct(f3.accuracy)} | ${ta ? pct(ta.accuracy) : '\u2014'} | ${pct(ma.accuracy)} | ${pct(ma.coverage)} |`)
    }
  }

  lines.push('')

  // Per-Event Detail
  lines.push('## Per-Event Results')
  lines.push('')
  lines.push('| Event | Type | Single 2.5 | Single 2.5P | TradingAgents | Multi-Agent | Actual |')
  lines.push('|-------|------|-----------|-----------|--------------|-------------|--------|')

  for (const result of report.results) {
    lines.push(
      `| ${result.eventId} | ${result.eventType} | ${result.singleAgent.direction} | ${result.pro25SingleAgent.direction} | ${result.tradingAgents.direction} | ${result.multiAgent.direction} | ${result.actual.netDirection} |`,
    )
  }

  lines.push('')
  lines.push('---')
  lines.push('*Generated by Prism Evaluation Harness*')

  return lines.join('\n')
}
