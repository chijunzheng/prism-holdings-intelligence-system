import { useState } from 'react'

export interface StrategyCommandMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
}

interface StrategyCommandPanelProps {
  readonly messages: ReadonlyArray<StrategyCommandMessage>
  readonly disabled: boolean
  readonly onSubmit: (message: string) => void
}

const SUGGESTED_COMMANDS = [
  'Build mitigation plan for this signal',
  'Add ZAG',
  'Set ZAG to 2%',
  'Evaluate scenario',
] as const

export function StrategyCommandPanel({
  messages,
  disabled,
  onSubmit,
}: StrategyCommandPanelProps) {
  const [input, setInput] = useState('')

  const submit = (): void => {
    const value = input.trim()
    if (!value || disabled) return
    onSubmit(value)
    setInput('')
  }

  return (
    <section className="strategy-command" aria-label="Prism strategy command console">
      <header className="strategy-command__header">
        <h3>Prism Console</h3>
        <p>Use chat commands to build and refine the scenario.</p>
      </header>

      <div className="strategy-command__messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`strategy-command__message strategy-command__message--${message.role}`}
          >
            <span className="strategy-command__role">{message.role === 'assistant' ? 'Prism' : 'You'}</span>
            <p>{message.content}</p>
          </div>
        ))}
      </div>

      <div className="strategy-command__suggestions">
        {SUGGESTED_COMMANDS.map((command) => (
          <button
            key={command}
            type="button"
            disabled={disabled}
            onClick={() => onSubmit(command)}
          >
            {command}
          </button>
        ))}
      </div>

      <div className="strategy-command__composer">
        <input
          type="text"
          placeholder="Type a command (e.g. Add ZAG)"
          value={input}
          disabled={disabled}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
        <button type="button" disabled={disabled} onClick={submit}>
          {disabled ? 'Running...' : 'Run'}
        </button>
      </div>
    </section>
  )
}
