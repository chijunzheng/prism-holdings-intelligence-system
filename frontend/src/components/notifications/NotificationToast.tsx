import { useEffect, useState } from 'react'
import type { Notification } from '@prism/shared'

interface NotificationToastProps {
  readonly notification: Notification
  readonly index: number
  readonly onDismiss: (id: string) => void
  readonly onClick: () => void
}

const AUTO_DISMISS_MS = 6_000

function formatUrgencyLabel(urgency: string): string {
  if (urgency === 'critical') return 'Critical'
  if (urgency === 'high') return 'High Priority'
  return 'New Signal'
}

export function NotificationToast({ notification, index, onDismiss, onClick }: NotificationToastProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onDismiss(notification.id), 300)
    }, AUTO_DISMISS_MS + index * 1_000)
    return () => clearTimeout(timer)
  }, [notification.id, index, onDismiss])

  const urgencyClass = notification.urgency === 'critical'
    ? 'toast--critical'
    : notification.urgency === 'high'
      ? 'toast--high'
      : 'toast--medium'

  const dismiss = () => {
    setExiting(true)
    setTimeout(() => onDismiss(notification.id), 300)
  }

  return (
    <div
      className={`notification-toast ${urgencyClass} ${exiting ? 'notification-toast--exit' : ''}`}
      style={{ '--toast-index': index } as React.CSSProperties}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={notification.headline}
    >
      <div className="notification-toast__accent" />
      <div className="notification-toast__body">
        <span className="notification-toast__label">{formatUrgencyLabel(notification.urgency)}</span>
        <span className="notification-toast__headline">{notification.headline}</span>
      </div>
      <button
        type="button"
        className="notification-toast__close"
        onClick={(e) => {
          e.stopPropagation()
          dismiss()
        }}
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
