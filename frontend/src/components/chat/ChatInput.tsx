import { useEffect, useState } from 'react'

interface ChatInputProps {
  readonly onSend: (message: string) => void
  readonly disabled?: boolean
  readonly initialValue?: string
  readonly placeholder?: string
  readonly minRows?: number
}

export function ChatInput({
  onSend,
  disabled = false,
  initialValue,
  placeholder = 'Ask Prism about your portfolio and signals...',
  minRows = 2,
}: ChatInputProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (initialValue) {
      setValue(initialValue)
    }
  }, [initialValue])

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <textarea
        className="chat-input__textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={minRows}
      />
      <button
        type="submit"
        className="chat-input__send"
        aria-label="Send message"
        disabled={disabled || !value.trim()}
      >
        <svg
          className="chat-input__send-icon"
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      </button>
    </form>
  )
}
