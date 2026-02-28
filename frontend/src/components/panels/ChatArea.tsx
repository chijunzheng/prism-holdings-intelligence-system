// ChatArea — main chat message stream with input.
// Renders messages as text or rich cards via ChatCardRenderer.

import { useRef, useEffect, useCallback, useState } from 'react'
import { ChatInput } from '../chat/ChatInput'
import { ChatMessage } from '../chat/ChatMessage'
import { ChatCardRenderer } from '../chat-cards/ChatCardRenderer'
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat'

interface ChatAreaProps {
  readonly userId: string
  readonly activeSessionId: string | null
}

type ChatCardData = {
  readonly type: string
  readonly data: unknown
}

type EnhancedMessage = ChatMessageType & {
  readonly card?: ChatCardData
}

export function ChatArea({ userId, activeSessionId }: ChatAreaProps) {
  const [messages, setMessages] = useState<readonly EnhancedMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load welcome message when no session
  useEffect(() => {
    if (!activeSessionId && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Welcome to Prism. I can help you understand how market events affect your portfolio. Tap a signal to analyze it, or ask me anything about your holdings.',
      }])
    }
  }, [activeSessionId, messages.length])

  const handleSend = useCallback(
    async (content: string) => {
      if (isLoading) return

      const userMsg: EnhancedMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
      }

      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      try {
        const res = await fetch(`/api/chat/${userId}/ask-prism`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page: 'portfolio',
            message: content,
            history: messages
              .filter((m) => m.role !== 'divider')
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        })

        if (!res.ok) throw new Error('Chat request failed')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const assistantId = `msg-${Date.now()}-assistant`
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '', isStreaming: true },
        ])

        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data) as { text: string }
              accumulated += parsed.text
              const snapshot = accumulated
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: snapshot, isStreaming: true } : m,
                ),
              )
            } catch {
              // Skip malformed chunks
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m,
          ),
        )
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-error`,
            role: 'assistant',
            content: `Sorry, something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ])
      }

      setIsLoading(false)
    },
    [isLoading, messages, userId],
  )

  const handleCheckpointSubmit = useCallback((_value: string) => {
    // TODO: Wire to /api/v2/analyze/:threadId/resume
  }, [])

  return (
    <div className="chat-area">
      <div className="chat-area__messages">
        {messages.map((msg) => {
          if (msg.card) {
            return (
              <div key={msg.id} className="chat-area__card-wrapper">
                <ChatCardRenderer
                  card={msg.card}
                  onCheckpointSubmit={handleCheckpointSubmit}
                />
              </div>
            )
          }
          return <ChatMessage key={msg.id} message={msg} />
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-area__input">
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  )
}
