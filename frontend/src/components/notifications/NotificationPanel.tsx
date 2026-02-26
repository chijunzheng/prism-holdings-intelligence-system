import type { Notification } from '@prism/shared'
import { NotificationItem } from './NotificationItem'

interface NotificationPanelProps {
  readonly notifications: ReadonlyArray<Notification>
  readonly onClickNotification: (notification: Notification) => void
  readonly onMarkAllRead: () => void
}

export function NotificationPanel({
  notifications,
  onClickNotification,
  onMarkAllRead,
}: NotificationPanelProps) {
  const hasUnread = notifications.some((n) => !n.read)

  return (
    <div className="notification-panel">
      <div className="notification-panel__header">
        <span className="notification-panel__title">Notifications</span>
        {hasUnread && (
          <button className="notification-panel__mark-all" onClick={onMarkAllRead}>
            Mark all read
          </button>
        )}
      </div>
      <div className="notification-panel__list">
        {notifications.length === 0 ? (
          <div className="notification-panel__empty">
            All caught up. We're monitoring your portfolio.
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onClickNotification={onClickNotification}
            />
          ))
        )}
      </div>
    </div>
  )
}
