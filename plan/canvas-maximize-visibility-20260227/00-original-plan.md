# Original Plan: Canvas Maximize + Visibility

## Problem
- Graph canvases feel small relative to available space.
- Users see unnecessary empty space around graph content.
- No consistent fullscreen affordance across canvases.

## Plan
1. Update shared graph auto-fit scale and padding.
2. Implement shared maximize/exit controls in `CausalGraph`.
3. Add fullscreen graph container styles.
4. Remove redundant inner outline from graph surface.
5. Verify all canvas pages inherit behavior via shared component.
