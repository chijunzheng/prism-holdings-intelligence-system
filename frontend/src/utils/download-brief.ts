// download-brief.ts — generates markdown from a ResearchBrief and triggers a file download.

import type { ResearchBrief } from '@prism/shared'

export function generateBriefMarkdown(brief: ResearchBrief): string {
  const lines: string[] = [
    '# Research Brief',
    '',
    `**Generated:** ${brief.generatedAt}`,
    `**Quality Score:** ${(brief.qualityScore * 100).toFixed(0)}%`,
    `**Impact Range:** $${brief.impactRange.low.toLocaleString()} to $${brief.impactRange.high.toLocaleString()}`,
    '',
  ]

  for (const section of brief.sections) {
    lines.push(`## ${section.title}`, '', section.content, '')
  }

  if (brief.sources.length > 0) {
    lines.push('## Sources', '')
    for (const source of brief.sources) {
      const url = source.url ? ` — ${source.url}` : ''
      lines.push(`${source.index}. ${source.description}${url}`)
    }
    lines.push('')
  }

  lines.push('---', '', brief.disclaimer)
  return lines.join('\n')
}

export function downloadBrief(brief: ResearchBrief): void {
  const markdown = generateBriefMarkdown(brief)
  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `research-brief-${brief.signalId}-${new Date().toISOString().slice(0, 10)}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
