import type { Response } from 'express'
import type { Notification, NotificationUrgency } from '@prism/shared'
import { randomUUID } from 'crypto'

interface FrequencyCap {
  readonly maxPerWindow: number
  readonly windowMs: number
}

const FREQUENCY_CAPS: Record<NotificationUrgency, FrequencyCap> = {
  critical: { maxPerWindow: 1, windowMs: 60 * 60 * 1000 },   // 1/hour
  high: { maxPerWindow: 3, windowMs: 24 * 60 * 60 * 1000 },  // 3/day
  medium: { maxPerWindow: 10, windowMs: 24 * 60 * 60 * 1000 }, // 10/day
}

const MAX_PER_USER = 50
const TTL_MS = 24 * 60 * 60 * 1000

const notificationStore = new Map<string, Notification[]>()
const sseSubscribers = new Map<string, Set<Response>>()

function pruneExpired(userId: string): ReadonlyArray<Notification> {
  const existing = notificationStore.get(userId) ?? []
  const cutoff = Date.now() - TTL_MS
  const fresh = existing.filter((n) => new Date(n.createdAt).getTime() > cutoff)
  notificationStore.set(userId, fresh)
  return fresh
}

function isWithinFrequencyCap(userId: string, urgency: NotificationUrgency): boolean {
  const cap = FREQUENCY_CAPS[urgency]
  const notifications = pruneExpired(userId)
  const windowStart = Date.now() - cap.windowMs
  const recentCount = notifications.filter(
    (n) => n.urgency === urgency && new Date(n.createdAt).getTime() > windowStart,
  ).length
  return recentCount < cap.maxPerWindow
}

function pushSse(userId: string, notification: Notification): void {
  const subscribers = sseSubscribers.get(userId)
  if (!subscribers) return
  const data = `data: ${JSON.stringify(notification)}\n\n`
  for (const res of subscribers) {
    try {
      res.write(data)
    } catch {
      subscribers.delete(res)
    }
  }
}

export function createNotification(params: {
  readonly userId: string
  readonly type: Notification['type']
  readonly signalId?: string
  readonly headline: string
  readonly description: string
  readonly urgency: NotificationUrgency
}): Notification | null {
  if (!isWithinFrequencyCap(params.userId, params.urgency)) {
    return null
  }

  const notification: Notification = {
    id: randomUUID(),
    userId: params.userId,
    type: params.type,
    signalId: params.signalId,
    headline: params.headline,
    description: params.description,
    urgency: params.urgency,
    createdAt: new Date().toISOString(),
    read: false,
    dismissed: false,
  }

  const existing = notificationStore.get(params.userId) ?? []
  const updated = [notification, ...existing].slice(0, MAX_PER_USER)
  notificationStore.set(params.userId, updated)

  pushSse(params.userId, notification)
  return notification
}

export function getNotifications(
  userId: string,
  options?: { readonly unreadOnly?: boolean },
): ReadonlyArray<Notification> {
  const all = pruneExpired(userId)
  if (options?.unreadOnly) {
    return all.filter((n) => !n.read)
  }
  return all
}

export function markAsRead(userId: string, notificationId: string): boolean {
  const notifications = notificationStore.get(userId)
  if (!notifications) return false

  const target = notifications.find((n) => n.id === notificationId)
  if (!target) return false

  // Immutable update
  notificationStore.set(
    userId,
    notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
  )
  return true
}

export function markAllAsRead(userId: string): void {
  const notifications = notificationStore.get(userId)
  if (!notifications) return

  notificationStore.set(
    userId,
    notifications.map((n) => (n.read ? n : { ...n, read: true })),
  )
}

export function clearUserNotifications(userId: string): void {
  notificationStore.delete(userId)
}

export function subscribeSse(userId: string, res: Response): () => void {
  if (!sseSubscribers.has(userId)) {
    sseSubscribers.set(userId, new Set())
  }
  sseSubscribers.get(userId)!.add(res)

  return () => {
    const subs = sseSubscribers.get(userId)
    if (subs) {
      subs.delete(res)
      if (subs.size === 0) sseSubscribers.delete(userId)
    }
  }
}
