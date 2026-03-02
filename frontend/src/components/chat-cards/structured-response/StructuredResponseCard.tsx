import type {
  StructuredResponseData,
  StructuredSection,
  HoldingItemSection as HoldingItemData,
  MetricRowSection as MetricRowData,
  TextSection as TextData,
} from '@prism/shared'
import { renderMarkdown } from '../../chat/render-markdown'
import { TickerIcon } from '../../common/TickerIcon'
import { SummarySection } from './SummarySection'
import { SignalItemSection } from './SignalItemSection'
import { InsightSection } from './InsightSection'
import { ActionItemSection } from './ActionItemSection'
import { GroupSection } from './GroupSection'
import '../../../styles/structured-response.css'

interface StructuredResponseCardProps {
  readonly data: StructuredResponseData
  readonly onFollowUp?: (query: string) => void
  readonly onSignalAnalyze?: (signalId: string) => void
}

// ── Inline section renderers (simple enough to not warrant own file) ──

function TextSectionInline({ data }: { readonly data: TextData }) {
  return <div className="sr__text">{renderMarkdown(data.body)}</div>
}

function HoldingItemSectionInline({ data }: { readonly data: HoldingItemData }) {
  return (
    <div className="sr__holding-item">
      <div className="sr__holding-item-header">
        <TickerIcon ticker={data.ticker} size={24} />
        <div className="sr__holding-item-info">
          <span className="sr__holding-item-ticker">{data.ticker}</span>
          <span className="sr__holding-item-name">{data.name}</span>
        </div>
        <span className="sr__holding-item-value">{data.value}</span>
      </div>
      {data.detail && (
        <div className="sr__holding-item-detail">{renderMarkdown(data.detail)}</div>
      )}
      {data.relatedSignals && data.relatedSignals.length > 0 && (
        <div className="sr__holding-item-signals">
          {data.relatedSignals.map((s) => (
            <span key={s} className="sr__holding-item-signal-tag">{s}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function MetricRowSectionInline({ data }: { readonly data: MetricRowData }) {
  return (
    <div className="sr__metric-row">
      {data.metrics.map((m) => (
        <div
          key={m.label}
          className={`sr__metric-card ${m.sentiment ? `sr__metric-card--${m.sentiment}` : ''}`}
        >
          <span className="sr__metric-label">{m.label}</span>
          <span className="sr__metric-value">{m.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Card ─────────────────────────────────────────────

export function StructuredResponseCard({ data, onFollowUp, onSignalAnalyze }: StructuredResponseCardProps) {
  function renderSection(section: StructuredSection, index: number): React.ReactNode {
    const key = `sr-${section.type}-${index}`
    const style = { '--sr-delay': `${index * 0.05}s` } as React.CSSProperties

    switch (section.type) {
      case 'summary':
        return <div key={key} className="sr__section" style={style}><SummarySection data={section} /></div>
      case 'signal_item':
        return <div key={key} className="sr__section" style={style}><SignalItemSection data={section} onSignalAnalyze={onSignalAnalyze} onFollowUp={onFollowUp} /></div>
      case 'holding_item':
        return <div key={key} className="sr__section" style={style}><HoldingItemSectionInline data={section} /></div>
      case 'text':
        return <div key={key} className="sr__section" style={style}><TextSectionInline data={section} /></div>
      case 'insight':
        return <div key={key} className="sr__section" style={style}><InsightSection data={section} onFollowUp={onFollowUp} /></div>
      case 'action_item':
        return <div key={key} className="sr__section" style={style}><ActionItemSection data={section} onFollowUp={onFollowUp} /></div>
      case 'metric_row':
        return <div key={key} className="sr__section" style={style}><MetricRowSectionInline data={section} /></div>
      case 'group':
        return <div key={key} className="sr__section" style={style}><GroupSection data={section} renderSection={renderSection} /></div>
      default:
        return null
    }
  }

  return (
    <div className="sr">
      {data.sections.map((section, i) => renderSection(section, i))}

      {data.followUps && data.followUps.length > 0 && (
        <div className="sr__follow-ups">
          <span className="sr__follow-ups-label">Follow-ups</span>
          {data.followUps.map((f) => (
            <button
              key={f.text}
              className={`sr__follow-up ${f.priority === 'primary' ? 'sr__follow-up--primary' : 'sr__follow-up--secondary'}`}
              onClick={() => onFollowUp?.(f.text)}
            >
              {f.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
