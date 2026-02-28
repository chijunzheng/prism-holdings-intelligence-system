# Feature: Shared Causal Graph Controls

## Goal
Enable maximize + reset controls in shared graph canvases with stable UX.

## Tasks
- Add maximize toggle state to shared graph container class logic.
- Ensure resize observer supports fullscreen bounds.
- Keep `Escape` to exit maximize and clear hover/pin states.
- Ensure controls render predictably for canvas mode.

## Acceptance
- Maximize button visible in canvas maps.
- Exit works from button and `Escape`.
- No clipping or broken interaction while maximized.
