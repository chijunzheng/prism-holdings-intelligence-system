import { useCallback, useEffect, useRef, useState } from 'react'
import type { Notification } from '@prism/shared'

interface NotificationsState {
  readonly notifications: ReadonlyArray<Notification>
  readonly unreadCount: number
  readonly loading: boolean
}

interface NotificationsApiResponse {
  readonly success: boolean
  readonly data?: ReadonlyArray<Notification>
}

const MAX_RECONNECT_DELAY_MS = 30_000

export function useNotifications(userId: string) {
  const [state, setState] = useState<NotificationsState>({
    notifications: [],
    unreadCount: 0,
    loading: true,
  })
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectDelayRef = useRef(1_000)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(`/api/notifications/${userId}`)
      const payload = (await response.json()) as NotificationsApiResponse
      if (payload.success && payload.data) {
        setState({
          notifications: payload.data,
          unreadCount: payload.data.filter((n) => !n.read).length,
          loading: false,
        })
      }
    } catch {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [userId])

  const connectSse = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(`/api/notifications/${userId}/stream`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as Notification | { type: string }
        if ('type' in data && data.type === 'connected') {
          reconnectDelayRef.current = 1_000
          return
        }
        // New notification arrived
        const notification = data as Notification
        setState((prev) => ({
          notifications: [notification, ...prev.notifications],
          unreadCount: prev.unreadCount + 1,
          loading: false,
        }))
      } catch {
        // Ignore parse errors
      }
    }

    es.onerror = () => {
      es.close()
      const delay = reconnectDelayRef.current
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS)
      setTimeout(connectSse, delay)
    }
  }, [userId])

  useEffect(() => {
    void fetchNotifications()
    connectSse()

    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [fetchNotifications, connectSse])

  const markAsRead = useCallback(
    async (notificationId: string) => {
      await fetch(`/api/notifications/${userId}/${notificationId}/read`, { method: 'POST' })
      setState((prev) => ({
        notifications: prev.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
        loading: false,
      }))
    },
    [userId],
  )

  const markAllAsRead = useCallback(async () => {
    await fetch(`/api/notifications/${userId}/read-all`, { method: 'POST' })
    setState((prev) => ({
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
      loading: false,
    }))
  }, [userId])

  return {
    ...state,
    markAsRead,
    markAllAsRead,
  }
}
