import { z } from 'zod'

export const NotificationType = z.enum(['new_signal', 'signal_update', 'concentration_alert'])
export type NotificationType = z.infer<typeof NotificationType>

export const NotificationUrgency = z.enum(['critical', 'high', 'medium'])
export type NotificationUrgency = z.infer<typeof NotificationUrgency>

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationType,
  signalId: z.string().optional(),
  headline: z.string(),
  description: z.string(),
  urgency: NotificationUrgency,
  createdAt: z.string().datetime(),
  read: z.boolean(),
  dismissed: z.boolean(),
})
export type Notification = z.infer<typeof NotificationSchema>
