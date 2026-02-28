// CheckpointCard — captures user input at pipeline checkpoints.
// Shows quick reply chips + text input for corrections.

import { useState } from 'react'

interface CheckpointData {
  readonly stage: string
  readonly prompt: string
  readonly quickReplies?: readonly string[]
}

interface CheckpointCardProps {
  readonly data: unknown
  readonly onSubmit?: (value: string) => void
}

export function CheckpointCard({ data, onSubmit }: CheckpointCardProps) {
  const checkpoint = data as CheckpointData
  const [inputValue, setInputValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(value: string) {
    setSubmitted(true)
    onSubmit?.(value)
  }

  if (submitted) {
    return (
      <div className="chat-card chat-card--checkpoint chat-card--checkpoint-submitted">
        <span className="chat-card__check">&#10003;</span>
        <span>Input received. Continuing analysis...</span>
      </div>
    )
  }

  return (
    <div className="chat-card chat-card--checkpoint">
      <h4 className="chat-card__title">Your Input Needed</h4>
      <p className="chat-card__prompt">{checkpoint.prompt}</p>

      {checkpoint.quickReplies && checkpoint.quickReplies.length > 0 && (
        <div className="chat-card__quick-replies">
          {checkpoint.quickReplies.map((reply) => (
            <button
              key={reply}
              className="chat-card__chip"
              onClick={() => handleSubmit(reply)}
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      <div className="chat-card__input-row">
        <input
          type="text"
          className="chat-card__text-input"
          placeholder="Or type your correction..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && inputValue.trim()) {
              handleSubmit(inputValue.trim())
            }
          }}
        />
        <button
          className="chat-card__btn chat-card__btn--primary"
          onClick={() => handleSubmit(inputValue.trim() || 'continue')}
        >
          {inputValue.trim() ? 'Submit' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
