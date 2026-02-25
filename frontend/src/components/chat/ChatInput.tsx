import { useEffect, useState } from 'react'

interface ChatInputProps {
  readonly onSend: (message: string) => void
  readonly disabled?: boolean
  readonly initialValue?: string
}

export function ChatInput({ onSend, disabled = false, initialValue }: ChatInputProps) {
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
        placeholder="Ask about this node..."
        disabled={disabled}
        rows={2}
      />
      <button
        type="submit"
        className="chat-input__send"
        disabled={disabled || !value.trim()}
      >
        Send
      </button>
    </form>
  )
}
