# Feature: Prism-Guided Plan Builder (3-Step Wizard)

**ID:** 08
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 05 (Page Narration for Step 1), 07 (Plain-English Eval for Step 3)
**Phase:** 3 — Conversational Planning
**Plan References:** A2, J7

## Description

The current PlanView drops users into a complex dashboard with reasoning graph, candidate grid, allocation sliders, and evaluation sidebar all at once. Overwhelming for everyday investors.

Replace the default entry with a 3-step conversational wizard driven by Prism:

1. **"Here's the situation"** — Signal headline + plain-English impact + do-nothing baseline
2. **"Here are your options"** — 2-3 pre-built packages (Do nothing / Light / Balanced) as selectable cards
3. **"Review your plan"** — Confirmation with plain-English summary and next steps

"Customize your own plan →" at the bottom opens the full candidate grid (current UI, hidden by default).

## Acceptance Criteria

- [ ] Backend generates 3 named packages (Conservative/Balanced/Aggressive) from existing presets
- [ ] `StrategyDraft` response includes `packages` array alongside existing `candidates`
- [ ] New `<PlanWizard>` component wraps the 3-step flow
- [ ] Step 1 shows signal narration + do-nothing baseline impact bar
- [ ] Step 2 shows package cards: Do nothing, Light protection, Balanced response
- [ ] Each package card shows: name, description, expected benefit range, estimated cost
- [ ] Step 3 shows confirmation with ticker list + expected outcome + next steps
- [ ] "Customize" link at bottom of Step 2 swaps to the full PlanView
- [ ] "Save plan" on Step 3 saves to Playbook
- [ ] Packages use existing evaluation logic — each package is pre-evaluated
- [ ] Wizard is the default entry; full PlanView is opt-in via "Customize"

## Implementation Details

### Files to Create

- `frontend/src/components/plan/PlanWizard.tsx` — 3-step wizard wrapper
- `frontend/src/components/plan/PlanWizardStep1.tsx` — Situation overview
- `frontend/src/components/plan/PlanWizardStep2.tsx` — Package selection
- `frontend/src/components/plan/PlanWizardStep3.tsx` — Confirmation
- `frontend/src/components/plan/PackageCard.tsx` — Individual package option card
- `frontend/src/styles/plan-wizard.css` — Wizard styles

### Files to Modify

- `agents/src/strategy-simulator/index.ts` — Extend `buildStrategyDraft()` to return packages
- `shared/src/types/strategy.ts` — Add `StrategyPackage` type
- `frontend/src/hooks/usePlan.ts` — Add `packages` state
- `frontend/src/routes/signal/PlanView.tsx` — Wrap with wizard/customize toggle

### Backend: Package Generation

In `buildStrategyDraft()`, after generating candidates:

```typescript
interface StrategyPackage {
  readonly name: string           // "Light Protection" | "Balanced Response" | "Strong Hedge"
  readonly description: string    // Plain-English description
  readonly candidates: ReadonlyArray<{ candidateId: string; ticker: string; allocationPct: number }>
  readonly evaluation: StrategyEvaluation
  readonly estimatedCostCad: number
}
```

Generate 3 packages by applying presets to existing candidates:
- **Conservative (Light):** Top 1 candidate at minimum allocation (proposed %)
- **Balanced:** Top 2 candidates at proposed allocation
- **Aggressive (Strong):** Top 3 candidates at proposed + 1% allocation

Evaluate each package using existing `evaluateScenarioModel()`.

"Do nothing" is implicit — it's the baseline evaluation with empty scenario.

### Frontend: PlanWizard

```typescript
interface PlanWizardProps {
  readonly packages: ReadonlyArray<StrategyPackage>
  readonly draft: StrategyDraft
  readonly signalId: string
  readonly userId: string
  readonly onSelectPackage: (pkg: StrategyPackage) => void
  readonly onCustomize: () => void
  readonly onSave: () => void
}
```

State: `step: 1 | 2 | 3`, `selectedPackage: StrategyPackage | null`

- Step 1 → Step 2: "See my options" button
- Step 2 → Step 3: Tap a package card
- Step 3 → Save: "Save plan" button
- Step 2 → Full PlanView: "Customize" link calls `onCustomize()`
- Back navigation between steps

### PlanView Integration

```typescript
const [wizardMode, setWizardMode] = useState(true)

// In render:
{wizardMode && packages.length > 0 ? (
  <PlanWizard
    packages={packages}
    draft={draft}
    onSelectPackage={handlePackageSelect}
    onCustomize={() => setWizardMode(false)}
    onSave={handleSave}
  />
) : (
  // Existing full PlanView content
)}
```

`handlePackageSelect` applies the package's candidates + allocations via `usePlan.applyCopilotActions()`.

## Dependencies

### Depends On
- **Feature 05:** PrismNarration component for Step 1 signal narration
- **Feature 07:** Plain-English evaluation formatting for Step 3 confirmation

## Testing Requirements

- [ ] Unit test: `buildStrategyDraft()` returns packages array with evaluations
- [ ] Unit test: PlanWizard renders correct step based on state
- [ ] Unit test: Package selection applies candidates via applyCopilotActions
- [ ] Unit test: "Customize" swaps to full PlanView
- [ ] Unit test: Back navigation works between steps

## Implementation Checklist

- [ ] Add `StrategyPackage` type to shared types
- [ ] Extend `buildStrategyDraft()` to generate packages
- [ ] Add `packages` to usePlan hook state
- [ ] Create PlanWizard + step components
- [ ] Create PackageCard component
- [ ] Integrate wizard into PlanView with toggle
- [ ] Add wizard styles
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
