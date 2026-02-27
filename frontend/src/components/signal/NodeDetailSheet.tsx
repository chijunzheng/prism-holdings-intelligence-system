import type { CausalChainNode } from '@prism/shared'

interface NodeDetailSheetProps {
  readonly node: CausalChainNode
  readonly onClose: () => void
}

export function NodeDetailSheet({ node, onClose }: NodeDetailSheetProps) {
  return (
    <div className="node-sheet-overlay" onClick={onClose}>
      <div className="node-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="node-sheet__header">
          <h3 className="node-sheet__title">{node.label}</h3>
          <button type="button" className="node-sheet__close" onClick={onClose}>
            Close
          </button>
        </div>
        <span className="node-sheet__type">{node.type}</span>
        <p className="node-sheet__description">{node.description}</p>
        <div className="node-sheet__meta">
          <span>Confidence: {(node.confidence * 100).toFixed(0)}%</span>
          {node.dollarImpact !== undefined && (
            <span>Impact: ${Math.abs(node.dollarImpact).toFixed(0)}</span>
          )}
          {node.temporalClassification && (
            <span>{node.temporalClassification}</span>
          )}
        </div>
      </div>
    </div>
  )
}
