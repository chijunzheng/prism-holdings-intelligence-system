const DEFAULT_PROMPTS = [
  'Why does this affect my portfolio?',
  'What should I do?',
  'What if this is temporary?',
  'Show me the other side',
  'How confident is this analysis?',
] as const

interface SuggestedPromptsProps {
  readonly onSelect: (prompt: string) => void
  readonly disabled?: boolean
  readonly prompts?: readonly string[]
}

export function SuggestedPrompts({ onSelect, disabled = false, prompts = DEFAULT_PROMPTS }: SuggestedPromptsProps) {
  return (
    <div className="chat-suggested">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          className="chat-suggested__button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </button>
      ))}
    </div>
  )
}
