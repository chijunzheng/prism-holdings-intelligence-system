import type { CausalChainNode } from '@prism/shared'

interface NodeDetailsProps {
  readonly node: CausalChainNode | null
}

export function NodeDetails({ node }: NodeDetailsProps) {
  if (!node) {
    return (
      <p className="node-details__placeholder">
        Click a node on the causal graph to view its details.
      </p>
    )
  }

  return (
    <div className="node-details">
      <div>
        <h3 className="node-details__label">{node.label}</h3>
        <span className="node-details__type">{node.type}</span>
      </div>

      {node.description && (
        <p className="node-details__description">{node.description}</p>
      )}

      <dl>
        {node.temporalClassification && (
          <div className="node-details__row">
            <dt>Classification</dt>
            <dd>{node.temporalClassification}</dd>
          </div>
        )}
        {node.percentageImpact !== undefined && (
          <div className="node-details__row">
            <dt>Impact</dt>
            <dd>{node.percentageImpact > 0 ? '+' : ''}{(node.percentageImpact * 100).toFixed(1)}%</dd>
          </div>
        )}
        {node.dollarImpact !== undefined && (
          <div className="node-details__row">
            <dt>Dollar Impact</dt>
            <dd>${node.dollarImpact.toFixed(2)} CAD</dd>
          </div>
        )}
        <div className="node-details__row">
          <dt>Confidence</dt>
          <dd>{(node.confidence * 100).toFixed(0)}%</dd>
        </div>
      </dl>
    </div>
  )
}
