# End-to-End Playbook & Signal Journey Improvements

## Design Principle
**Wealthsimple simplicity for everyday investors.** Hide complexity, surface clarity. Every screen should answer one question clearly. The journey should feel like: "Something happened → here's how it affects you → here's what you can do → you're covered."

**AI Principle:** Prism should feel like a knowledgeable friend who happens to understand finance — not a trading terminal with a chatbot bolted on. The AI should *drive* the experience, not sit in a drawer waiting to be opened.

---

## Part 1: Critical Flow Fixes (Broken Plumbing)

### F1. Restore Signal Cards on Portfolio View
`SignalCardsSection` is fully built but not rendered on `PortfolioView`. The core "pull" mechanism is dead.
**Files:** `frontend/src/routes/PortfolioView.tsx`

### F2. Fix "Build a Plan" Navigation
`SignalImpactSidebar.tsx` uses `<a href>` instead of `<Link>`, causing full page reload.
**Files:** `frontend/src/components/signal/SignalImpactSidebar.tsx`

### F3. Synchronize Horizon Across Graph and Sidebar
Graph always renders `oneMonth` while sidebar toggles 1W/1M/6M independently.
**Files:** `frontend/src/routes/signals/SignalDetailPane.tsx`

### F4. Show "Resume Plan" When One Exists
No UI indicates a saved plan exists for a signal.
**Files:** `SignalImpactSidebar.tsx`, new hook or API call

---

## Part 2: AI-Driven UX Improvements (Prism as the Guide)

### A1. Prism as Journey Narrator (Inline AI Summaries)
**Problem:** Each page shows raw data. Users must interpret graphs, metrics, and tables themselves. Prism sits in a drawer, unused unless explicitly opened.
**Improvement:** Prism generates **inline summary cards** embedded directly in each page — not in the chat drawer.

**Per-page narrations:**
- **Portfolio View:** "Your portfolio looks mostly healthy, but your 38% Canadian bank exposure could be affected by the BOC rate decision. Tap below to see more."
- **Signal Detail (above graph):** "This signal could cost you ~$340 this month. Your bond holdings (ZAG) are most exposed, while your bank stocks (ZEB) might benefit slightly."
- **Plan View (opening):** "I found 5 options to offset this risk. A balanced response — adding 2 positions — could reduce your estimated loss by about 60%."
- **Playbook (summary):** "You have 3 active plans covering 2 of your top 4 risk exposures. Your energy exposure has no plan yet."

**Implementation detail:**
- New server endpoint: `GET /api/narration/:userId/:page?signalId=...`
- Backend: `generatePageNarration(context, page)` in `agents/src/chat-agent/`:
  - Reuses the existing `AskPrismContext` builder (Layer 1-3 context already assembled in `server/src/index.ts`)
  - Calls Gemini with a short, focused prompt: "Summarize this context in 2-3 sentences for an everyday investor. No jargon. Use dollar amounts."
  - Cache key: `narration:${userId}:${page}:${signalId}` with 5-min TTL (module-level `Map` like existing `askPrismCache`)
- Frontend: New `<PrismNarration>` component — a styled card with Prism icon, narration text, and optional CTA button
  - Fetch on mount via `useEffect` + `useState`, show skeleton loader while loading
  - Place above the main content area on each page

### A2. Prism-Guided Plan Builder (Conversational Planning)
**Problem:** PlanView drops users into a complex dashboard with reasoning graph, candidate grid, allocation sliders, and evaluation sidebar all at once. Overwhelming for everyday investors.
**Improvement:** Make Prism the *primary interface* for plan building.

**Proposed UX — 3-step conversational flow:**

**Step 1: "Here's the situation" (Prism narration)**
- Full-width card at top: signal headline + plain-English impact
- "Do nothing" baseline prominently shown: "If you don't act, this could cost you ~$580 this month"
- Simple visual: impact bar showing current trajectory
- This replaces the current "Build Your Plan" header

**Step 2: "Here's what I'd suggest" (Prism options)**
- Prism presents 2-3 pre-built options as selectable cards (not a candidate grid):
  - **"Do nothing"** — "Accept the risk. No cost, no trades."
  - **"Light protection"** — "Add 1 position (ZAG). ~$400. Reduces risk by ~$180."
  - **"Balanced response"** — "Add 2 positions (ZAG + XGD). ~$1,200. Reduces risk by ~$350."
- Each option is ONE card with: name, description, expected benefit range, estimated cost
- "Customize your own plan →" link at the bottom → opens the full candidate grid (current UI, hidden by default)

**Step 3: "Review your plan" (Confirmation)**
- What you're adding (ticker list with amounts in plain English)
- Expected outcome: "Reduces estimated loss from ~$580 to ~$230"
- Next steps: copy summary, save to Playbook, link back to Wealthsimple

**Implementation detail:**
- Backend: Extend `buildStrategyDraft()` in `agents/src/strategy-simulator/index.ts`:
  - Already generates candidates and a default scenario (top 3 at proposed allocation)
  - Add: generate 3 named "packages" by applying existing presets (Conservative/Balanced/Aggressive) and evaluating each
  - Return: `packages: Array<{ name, description, candidates, evaluation }>` alongside the existing `candidates` array
  - The "Do nothing" package is implicit (baseline evaluation with empty scenario)
- Frontend: New `<PlanWizard>` component wrapping the 3-step flow:
  - Step 1: Uses `<PrismNarration>` (A1) with signal-specific content
  - Step 2: Renders `packages` as selectable option cards
  - Step 3: Renders simplified confirmation (reuse `PlanConfirmation` with plain-English text from A1)
  - Clicking "Customize" swaps to the existing `PlanView` content (the candidate grid, reasoning graph, etc.)
- `usePlan.ts`: Add `packages` state alongside existing `candidates`, `selections`, etc.

### A3. What-If Scenarios via Chat → Graph Re-render
**Problem:** `detectWhatIf()` exists in `agents/src/chat-agent/index.ts` (line 137) and uses Gemini to classify counterfactual questions. But it's only connected to the legacy `useChat` hook — `useAskPrismChat` doesn't use it. "What if the Fed reverses?" gets a text answer only.

**Improvement:** Connect what-if detection to the causal graph visualization.

**User flow:**
1. User on Signal Detail asks Prism: "What if oil prices drop instead?"
2. Prism detects counterfactual intent via `detectWhatIf()` → `{ isWhatIf: true, modifiedAssumption: "Oil prices decline" }`
3. Server re-runs `runGraphPipeline()` with the modified assumption injected into the event prompt
4. Frontend receives the alternative causal chain
5. Graph re-renders showing both chains (original dimmed, alternative highlighted) or a toggle between them
6. Prism narrates: "If oil drops, your energy holdings (XEG) would take a bigger hit (-$420 vs -$180), but your bonds would benefit (+$60). Here's the updated picture."

**Implementation detail:**
- Backend: New endpoint `POST /api/chat/:userId/what-if`:
  - Input: `{ message, signalId }`
  - Calls `detectWhatIf(message)` (already exists)
  - If `isWhatIf: true`, calls `runGraphPipeline(userId, signalId, { modifiedAssumption })` with the counterfactual
  - Returns: `{ isWhatIf, alternativeChain, narration }`
- Frontend (`useAskPrismChat` in `frontend/src/hooks/useChat.ts`):
  - Before standard Ask Prism flow, check if the message triggers what-if
  - If yes, fetch the alternative chain and pass it up via a callback to the parent view
  - `SignalDetailPane` receives the alternative chain and passes it to `CausalGraph` as `alternativeData`
- `CausalGraph` component (`frontend/src/components/graph/CausalGraph.tsx`):
  - Add `alternativeData` prop
  - When present, render original nodes at 30% opacity and alternative nodes at full opacity
  - Add a toggle: "Original" / "What if..." to switch between views
- Existing code to reuse:
  - `detectWhatIf()` in `agents/src/chat-agent/index.ts:137` — already classifies what-if questions
  - `runGraphPipeline()` in `agents/src/` — already generates causal chains from signals
  - `buildWhatIfDetectionPrompt()` in `agents/src/chat-agent/prompts.ts` — already builds the detection prompt

### A4. Prism Proactive Intelligence on Portfolio View
**Problem:** Signals are passive — user must navigate to `/signals` to discover them. The `SignalImpactSummary` shows aggregate numbers but no actionable individual signal cards.

**Improvement:** Prism proactively surfaces the most important insight on the Portfolio View.

**UX:**
- A single "Prism Insight" card at the top of the portfolio (between IntelligenceBriefing and holdings):
  - "Heads up — the BOC rate decision could cost you ~$340 this month. Your bond and bank holdings are most affected."
  - Two buttons: "Show me more →" (navigates to signal detail) | "Help me plan" (navigates to plan builder)
- Only shows for signals with estimated impact > $100 (configurable threshold)
- Max 1 insight card at a time (highest impact signal)
- Dismissible ("Got it" button that hides it for 24 hours)

**Implementation detail:**
- Backend: The narration endpoint (A1) generates this as part of `portfolio` page narration
  - Include `topSignalId`, `estimatedImpactCad`, and `suggestedAction` in the response
- Frontend: New `<PrismInsightCard>` component on `PortfolioView`:
  - Shows narration text + two CTA buttons
  - Uses `localStorage` for dismiss state (key: `prism-insight-dismissed:${signalId}`)
  - Only renders if `estimatedImpactCad > 100` and not dismissed

### A5. AI-Powered Graph Narration (Plain-English Node Descriptions)
**Problem:** Graph nodes show labels like "Canadian Bond Yield Shift" or "Credit Spread Compression." Everyday investors don't know what these mean.

**Improvement:** Each graph node gets a pre-computed `plainDescription` field — a one-sentence explanation in everyday language.

**Examples:**
- **Event node:** "The Bank of Canada just changed interest rates, which affects borrowing costs across the economy."
- **Mechanism node:** "When rates go up, bond prices typically go down because new bonds pay more interest."
- **Asset node:** "Your ZAG bond ETF could lose about $120 because it holds many bonds that become less valuable when rates rise."

**Implementation detail:**
- Backend: Extend the Gemini prompt in `runGraphPipeline()`:
  - Add to the causal chain generation prompt: "For each node, also generate a `plainDescription` field: a one-sentence explanation suitable for someone with no finance background. Use concrete dollar amounts where possible."
  - Add `plainDescription: string` to the `CausalNode` type in `shared/src/types/`
  - The Zod schema for chain validation already exists — add `plainDescription` as optional with fallback to `description`
- Frontend: `GraphNode` component (`frontend/src/components/graph/GraphNode.tsx`):
  - Show `plainDescription` on hover/tap as a tooltip
  - In the node detail panel, show `plainDescription` prominently above the technical details
  - Could also use this as the node label itself (toggled by a "Simple / Technical" view switch)

### A6. Plan Coach: Real-Time Inline Feedback
**Problem:** After each candidate add/remove/allocation change, the evaluation sidebar updates with numbers (turnover %, downside reduction $). Users must interpret the delta themselves.

**Improvement:** Prism provides a one-line coaching comment after each change, appearing as a subtle annotation near the evaluation sidebar.

**Examples:**
- Add ZAG: "Good start — that alone reduces your risk by about $120."
- Remove XGD: "Without gold, your plan now covers about 40% of the downside. You might want an alternative."
- Set allocation to 8%: "That's higher than typical — most plans use 3-5% for this type of position."
- Add 3rd candidate: "Three positions is a solid setup. Your plan now covers ~70% of the estimated downside."

**Implementation detail:**
- Frontend-only (no additional LLM call): Build `generateCoachingComment(prevEvaluation, newEvaluation, action)` utility in `frontend/src/components/plan/`:
  - Compare before/after `downsideReductionCad`, `turnoverPct`, `diversificationGain`
  - Template-based: map delta ranges to pre-written comments
  - E.g., if `turnoverPct > 7`: "Heads up — your plan requires more trades than usual"
  - E.g., if `downsideReductionCad` increased: "Nice — that improved your protection by ~${delta}"
- Display: A `<CoachingComment>` component — small text bubble with Prism icon, positioned between candidate cards and evaluation sidebar
- Animate: fade in on evaluation change, fade out after 5 seconds or when next change occurs

### A7. Unify Copilot Proposal with LLM (Structured Output)
**Problem:** `plan-copilot-service.ts` (line 225-275) uses `classifyIntent()` with keyword matching (`hasAny(text, ['add', 'recommend', 'buy'])`) and separate scoring formulas (`scoreCandidateForRisk`, `scoreCandidateForDiversification`). The LLM generates explanation text independently via `streamAskPrismResponse()`. These two systems can disagree — Prism might *say* "I recommend adding ZAG" but the proposal engine suggests a different ticker.

**Improvement:** Use Gemini structured output to generate BOTH the explanation AND the proposal actions in a single call.

**Implementation detail:**
- Backend: New function `generateUnifiedProposal()` in `agents/src/chat-agent/`:
  ```
  Input: AskPrismContext + userMessage + history
  Gemini prompt: "Given this portfolio and plan context, respond to the user's message.
    Return JSON: { explanation: string, actions: PlanAction[], confidence: number, followUps: string[] }
    Actions must only reference candidates from the provided universe."
  Output schema (Zod validated): { explanation, actions, confidence, followUps }
  ```
  - Use Gemini's structured output mode (JSON schema in `config.responseSchema`)
  - Validation-retry loop (max 2 retries, same pattern as causal chain generation)
  - If all retries fail, fall back to current rule-based `buildProposal()` + `streamAskPrismResponse()`
- Server endpoint: Update `POST /api/strategy/:userId/copilot-proposal` to use `generateUnifiedProposal()` first, fall back to existing split approach
- Keep `plan-copilot-service.ts` as the fallback — don't delete it

### A8. Cross-Scope Intent Memory
**Problem:** Each Ask Prism scope (portfolio, signal, plan) has its own thread (`askPrismCache` is a `Map` keyed by `{userId}:{scopeKey}`). When the user says "I'm worried about tech" on the portfolio page and then navigates to a signal, Prism has no memory of that concern.

**Improvement:** Maintain a lightweight `userIntentSummary` that persists across scopes within a session.

**Implementation detail:**
- Frontend: Add `userIntentSummary: string[]` to `AppContext` state (max 5 bullet points)
- After each Ask Prism response, extract key intents:
  - Simple heuristic: if the user message contains concern keywords ("worried", "concerned", "focus on", "avoid"), add a bullet: "User concerned about [extracted topic]"
  - Or: ask Gemini as a post-processing step (lightweight, ~50 token response): "Extract the user's key concern in 5 words or null"
- Pass `userIntentSummary` into `AskPrismContext`:
  - Add to `buildAskPrismPrompt()` as a new section: "## USER PREFERENCES (from earlier in this session)"
  - Gemini naturally incorporates these when generating responses
- Persistence: `sessionStorage` (survives page navigation, cleared on tab close)
- New field in `AskPrismContext` type: `userIntents?: string[]`

### A9. Prism as Navigating Copilot (The Big Vision)
**Problem:** Currently, Ask Prism is a Q&A drawer. `buildNavigationChips()` suggests passive links after responses. But the user still has to manually navigate, find the right element, and figure out what to do. Prism *talks about* the product but doesn't *drive* it.

**Vision:** Prism becomes a **copilot that guides you through the app** — it navigates between pages, highlights elements, applies changes, and walks you through decisions step by step.

**Copilot Capabilities (Progressive):**

#### Level 1: Navigate + Explain (Lowest complexity)
- Extend existing `AskPrismNavigationChip` type with `autoAction?: 'navigate'`
- On click: `navigate(chip.to)` + keep drawer open + set `activeAskPrismEntryContext` for the target page
- Already partially built: `buildNavigationChips()` generates route-aware links. Just need to make them smarter (LLM-suggested instead of keyword-scored) and keep the drawer open

#### Level 2: Navigate + Highlight (Medium complexity)
- New `CopilotAction` type with `navigate_and_highlight`
- Frontend: Add `copilotHighlight` state to `AppContext`
- Components check: `if (copilotHighlight?.elementType === 'graph_node' && copilotHighlight.elementId === node.id) → add 'highlighted' class`
- Graph nodes, holdings rows, signal cards: Add `.highlighted` CSS class with pulse animation

#### Level 3: Navigate + Act (Highest complexity)
- Extend `CopilotAction` type with `apply_plan_action`, `apply_preset`, `open_confirmation`, `mark_reviewed`
- Backend: LLM generates `CopilotAction` as structured output alongside text response
- Frontend: `AskPrismDrawer` processes `copilotAction`

### A10. Tap-First Copilot: Clickable Prompt Choices (No Typing Required)
**Problem:** Most everyday investors won't type questions into a chat. They don't know what to ask.

**Vision:** Prism presents **clickable choice cards** at every decision point — the user taps to advance, never needs to type.

**Three Prompt Modes:**
1. **Decision Cards** — 2-3 large tappable cards for choices
2. **Quick Reply Chips** — horizontal scrollable pills for follow-ups
3. **Guided Flow Steps** — numbered progress for multi-step flows

**New types:**
```typescript
type PromptChoice = {
  id: string
  label: string
  subtitle?: string
  icon?: string
  message: string
  copilotAction?: CopilotAction
}

type PromptMode = 'decision_cards' | 'quick_reply' | 'guided_flow'

type CopilotPromptSet = {
  mode: PromptMode
  choices: PromptChoice[]
  step?: { current: number, total: number, label: string }
}
```

**Implementation:**
- Extend Ask Prism response to include `promptSet?: CopilotPromptSet`
- New function `buildContextualPrompts(page, context, lastResponse)`
- Frontend: `<CopilotPromptSet>` component renders appropriate mode
- Decision cards: full-width, stacked vertically
- Quick replies: horizontal scroll, pill-shaped
- Guided flow: includes step indicator bar

---

## Part 3: Journey-Level UX Improvements

### J1. Signal Cards as Stories
Reframe: "How does the BOC rate decision affect your portfolio?" + "Could cost you ~$340 this month" + urgency as "Act soon" / "Watch" / "Low priority"

### J2. Portfolio Health as Entry Point
Make health grade clickable → navigates to signals filtered by severity.

### J3. "You're Covered" Indicator
Shield/checkmark on signal cards that have a reviewed plan.

### J4. Progressive Graph Disclosure
Start with simplified 3-node summary. "See full chain" expands to D3 graph.

### J5. Impact Summary Above Graph
Plain-English summary card above the graph (ties into A1 — Prism narration).

### J6. Sticky "What Can I Do?" CTA
Always visible at bottom of viewport. Changes text based on context.

### J7. 3-Step Wizard (Simplified, AI-Driven)
Same as A2 — deduplicated.

### J8. Simplify Candidate Cards
Default: ticker, name, rationale, "Reduces risk by ~$120". Expand for details.

### J9. Plain-English Evaluation
"Your plan reduces the estimated loss by about $250" instead of financial jargon.

### J10. "Do Nothing" Comparison Always Visible
Two paths: "Without a plan: -$580" | "With this plan: -$330"

### J11. Clear Next Steps After Confirmation
Copy to clipboard, link back to Playbook, opt-in follow-up notification.

### J12. Plan Status Journey
3 dots: Saved → Reviewed → Done. Gentle follow-up: "How did your plan go?"

### J13. Archive Instead of Delete
Wire up existing `archived` status. "Show past plans" toggle.

---

## Part 4: Backend Improvements

### B1. Live Price Data
Replace 20 hardcoded prices with Yahoo Finance API + 15-min cache.

### B2. Confidence Ranges
Generate low/mid/high estimates. Show "$150–$350 reduction" instead of "$247.32."

### B3. Signal Resolution Detection
Detect when signals weaken/resolve. Auto-flag stale plans. Notify user.

### B4. Page Narration Service
New `generatePageNarration()` function for A1. Cached per signal/page with 5-min TTL.

### B5. Cross-Scope User Intent Memory
Lightweight session-level store for A8. 3-5 bullet points summarizing user concerns.

---

## Recommended Implementation Order

**Phase 1 — Fix the Plumbing (1-2 days):**
- F1: Restore signal cards on Portfolio View
- F2: Fix `<a href>` → `<Link>` navigation
- F3: Synchronize horizon state
- F4: "Resume plan" indicator on signal detail
- J13: Wire up archive status

**Phase 2 — AI Narration Layer (3-5 days):**
- A1: Inline Prism narration on every page
- A5: Pre-computed `plainDescription` per graph node
- A6: Plan coaching comments
- J9: Plain-English evaluation sidebar

**Phase 3 — Conversational Planning (5-7 days):**
- A2: Prism-guided plan builder (3-step wizard)
- A4: Proactive insight card on Portfolio View
- J10: "Do nothing" comparison always visible

**Phase 4 — Navigating Copilot (7-10 days):**
- A9 Level 1: Smart navigation (2 days)
- A9 Level 2: Navigate + highlight (3 days)
- A9 Level 3: Navigate + act (3-5 days)
- A7: Unify copilot with LLM structured output
- A3: What-if → graph re-render
- A8: Cross-scope intent memory

**Phase 5 — Polish & Lifecycle (3-5 days):**
- J1: Signal cards as stories
- J6: Sticky "What can I do?" CTA
- J7-J8: Simplified candidate cards
- J11-J12: Post-plan lifecycle
- B1-B3: Live prices, confidence ranges, signal resolution

**Phase 6 — Tap-First Copilot (5-7 days):**
- A10: Clickable prompt choices (decision cards, quick replies, guided flow)
