# Feature: Synchronize Horizon Across Graph & Sidebar

**ID:** 02
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None
**Phase:** 1 — Fix the Plumbing
**Plan Reference:** F3

## Description

The causal graph always renders with `horizon="oneMonth"` (hardcoded in `SignalDetailPane.tsx`), while the `SignalImpactSidebar` has its own independent `horizon` state with a 1W/1M/6M toggle. Users see different impact numbers in the graph vs sidebar because they operate on different horizons.

Fix: Lift horizon state to `SignalDetailPane`, pass it down to both `CausalGraph` and `SignalImpactSidebar`.

## Acceptance Criteria

- [ ] Horizon state lives in `SignalDetailPane`, not duplicated
- [ ] Changing horizon in sidebar updates the graph's displayed impacts
- [ ] Changing horizon in sidebar updates the "Selected Node" panel impacts
- [ ] `CausalGraph` receives the current horizon from parent (not hardcoded)
- [ ] Default horizon is `oneMonth` (preserving current default)
- [ ] Horizon toggle is visually clear about which view is selected

## Implementation Details

### Files to Modify

- `frontend/src/routes/signals/SignalDetailPane.tsx` — Add `horizon` state, pass to children
- `frontend/src/components/signal/SignalImpactSidebar.tsx` — Accept `horizon` + `onHorizonChange` props instead of local state

### SignalDetailPane Changes

```typescript
// Add state:
const [horizon, setHorizon] = useState<GraphTimeHorizon>('oneMonth')

// Pass to CausalGraph:
<CausalGraph horizon={horizon} ... />

// Pass to SignalImpactSidebar:
<SignalImpactSidebar
  horizon={horizon}
  onHorizonChange={setHorizon}
  ...
/>

// Update selected node impact display:
const selectedImpact = selectedNode
  ? getHorizonAdjustedImpact(selectedNode, horizon)
  : 0
```

### SignalImpactSidebar Changes

Update props interface:
```typescript
interface Props {
  chain: CausalChain
  temporalAnalysis: TemporalAnalysis
  signalId: string
  horizon: GraphTimeHorizon           // NEW: from parent
  onHorizonChange: (h: GraphTimeHorizon) => void  // NEW: callback
}
```

Remove local `const [horizon, setHorizon] = useState(...)`. Replace `setHorizon(h)` calls with `onHorizonChange(h)`.

### Technical Decisions

- **Lift state up:** Standard React pattern. The sidebar owns the toggle UI, the parent owns the state, the graph receives it as prop.
- **No context needed:** Only two components share this state, both are siblings within `SignalDetailPane`.

## Dependencies

### Blocks
- **Feature 15 (What-If Graph):** Needs synced horizon to show alternative chains at the right time horizon

## Testing Requirements

- [ ] Unit test: Horizon change in sidebar updates graph's `horizon` prop
- [ ] Unit test: Node impact display uses current horizon (not hardcoded oneMonth)
- [ ] Manual: Toggle to 1W → graph shows weekly impacts; toggle to 6M → graph shows 6-month impacts

## Implementation Checklist

- [ ] Add `horizon` state to `SignalDetailPane`
- [ ] Replace hardcoded `"oneMonth"` with `horizon` variable in `CausalGraph` usage
- [ ] Update `SignalImpactSidebar` props to accept `horizon` + `onHorizonChange`
- [ ] Remove local horizon state from `SignalImpactSidebar`
- [ ] Update selected node impact display to use dynamic horizon
- [ ] Write unit tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
