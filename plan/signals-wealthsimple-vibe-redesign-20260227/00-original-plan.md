# Signals UX Redesign: Wealthsimple Vibe Alignment

## Goal
Make `Signals > All` feel like Wealthsimple UI patterns while preserving Prism's analytical purpose.

## Decisions
- Replace top chip strip with single dropdown selector.
- Add bottom timeframe rail (1W/1M/6M) under the causal graph.
- Use table-first contributions with inline row expansion for details.
- Strengthen heading hierarchy and spacing rhythm.

## Scope
1. New signal selector dropdown component for `/signals` combined view.
2. Update combined pane to wire horizon state into graph and summaries.
3. Rework contributions section into drillable table rows.
4. Update signals workspace styles to match Wealthsimple rhythm.

## Non-goals
- No backend/API changes.
- No portfolio page structural changes.
