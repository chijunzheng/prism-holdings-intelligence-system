import { describe, expect, it } from 'vitest'
import { parseStrategyCommand } from '../command-parser'

describe('parseStrategyCommand', () => {
  it('parses build draft intent from natural language', () => {
    const command = parseStrategyCommand('Build mitigation plan for Canadian rate sensitivity')
    expect(command).toEqual({
      type: 'build_draft',
      seedSummary: 'Build mitigation plan for Canadian rate sensitivity',
    })
  })

  it('parses add and remove ticker commands', () => {
    expect(parseStrategyCommand('Add zag')).toEqual({
      type: 'add_candidate',
      ticker: 'ZAG',
    })
    expect(parseStrategyCommand('remove vfv')).toEqual({
      type: 'remove_candidate',
      ticker: 'VFV',
    })
  })

  it('parses allocation and clamps bounds', () => {
    expect(parseStrategyCommand('Set zag to 2.5%')).toEqual({
      type: 'set_allocation',
      ticker: 'ZAG',
      allocationPct: 2.5,
    })
    expect(parseStrategyCommand('Set zag to 100%')).toEqual({
      type: 'set_allocation',
      ticker: 'ZAG',
      allocationPct: 10,
    })
  })

  it('parses evaluate and help commands', () => {
    expect(parseStrategyCommand('Evaluate scenario')).toEqual({ type: 'evaluate_scenario' })
    expect(parseStrategyCommand('help')).toEqual({ type: 'help' })
  })

  it('returns unknown for unmatched text', () => {
    expect(parseStrategyCommand('How did my portfolio do today?')).toEqual({ type: 'unknown' })
  })
})
