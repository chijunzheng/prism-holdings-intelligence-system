import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Notification } from '@prism/shared'
import { useAppContext } from '../../contexts/AppContext'
import { useNotifications } from '../../hooks/useNotifications'
import { NotificationPanel } from './NotificationPanel'
import { NotificationToast } from './NotificationToast'
import '../../styles/notifications.css'

const MAX_VISIBLE_TOASTS = 3

export function NotificationBell() {
  const { userId } = useAppContext()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)
  const [isOpen, setIsOpen] = useState(false)
  const [toastIds, setToastIds] = useState<ReadonlyArray<string>>([])
  const ref = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(unreadCount)
  const [pulse, setPulse] = useState(false)
  const navigate = useNavigate()

  // Show toasts when new unread notifications arrive
  useEffect(() => {
    if (unreadCount > prevCountRef.current && unreadCount > 0) {
      setPulse(true)
      const timer = setTimeout(() => setPulse(false), 1_000)

      // Find new notification IDs to toast
      const newNotifications = notifications
        .filter((n) => !n.read)
        .slice(0, unreadCount - prevCountRef.current)
        .map((n) => n.id)

      if (newNotifications.length > 0) {
        setToastIds((prev) => [...newNotifications, ...prev].slice(0, MAX_VISIBLE_TOASTS))
      }

      prevCountRef.current = unreadCount
      return () => clearTimeout(timer)
    }
    prevCountRef.current = unreadCount
  }, [unreadCount, notifications])

  // Dismiss toasts when panel opens
  useEffect(() => {
    if (isOpen) setToastIds([])
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDismissToast = useCallback((id: string) => {
    setToastIds((prev) => prev.filter((tid) => tid !== id))
  }, [])

  const handleToastClick = useCallback(() => {
    setIsOpen(true)
    setToastIds([])
  }, [])

  const handleClickNotification = useCallback(
    (notification: Notification) => {
      void markAsRead(notification.id)
      setIsOpen(false)

      if (notification.urgency === 'critical' || notification.urgency === 'high') {
        navigate('/signals')
      } else {
        navigate('/portfolio')
      }
    },
    [markAsRead, navigate],
  )

  const handleMarkAllRead = useCallback(() => {
    void markAllAsRead()
  }, [markAllAsRead])

  const displayCount = unreadCount > 9 ? '9+' : String(unreadCount)

  const activeToasts = toastIds
    .map((id) => notifications.find((n) => n.id === id))
    .filter((n): n is Notification => n !== undefined)

  return (
    <>
      {/* Toast stack — fixed top-right */}
      {activeToasts.length > 0 && (
        <div className="notification-toast-stack">
          {activeToasts.map((notification, index) => (
            <NotificationToast
              key={notification.id}
              notification={notification}
              index={index}
              onDismiss={handleDismissToast}
              onClick={handleToastClick}
            />
          ))}
        </div>
      )}

      {/* Bell icon + dropdown */}
      <div className="notification-bell" ref={ref}>
        <button
          className="notification-bell__trigger"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className={`notification-bell__badge ${pulse ? 'notification-bell__badge--pulse' : ''}`}>
              {displayCount}
            </span>
          )}
        </button>

        {isOpen && (
          <NotificationPanel
            notifications={notifications}
            onClickNotification={handleClickNotification}
            onMarkAllRead={handleMarkAllRead}
          />
        )}
      </div>
    </>
  )
}
