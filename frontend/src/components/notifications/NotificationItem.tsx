import type { Notification } from '@prism/shared'

interface NotificationItemProps {
  readonly notification: Notification
  readonly onClickNotification: (notification: Notification) => void
}

function formatRelativeTime(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationItem({ notification, onClickNotification }: NotificationItemProps) {
  const urgencyClass = notification.urgency === 'critical'
    ? 'notification-item--critical'
    : notification.urgency === 'high'
      ? 'notification-item--high'
      : 'notification-item--medium'

  return (
    <button
      className={`notification-item ${urgencyClass} ${notification.read ? '' : 'notification-item--unread'}`}
      onClick={() => onClickNotification(notification)}
    >
      {!notification.read && <span className="notification-item__dot" />}
      <div className="notification-item__content">
        <span className="notification-item__headline">{notification.headline}</span>
        <span className="notification-item__description">{notification.description}</span>
      </div>
      <span className="notification-item__time">{formatRelativeTime(notification.createdAt)}</span>
    </button>
  )
}
