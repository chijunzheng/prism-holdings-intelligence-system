import { getUserProfileById } from '@prism/data'
import type { UserProfile } from '@prism/shared'

export function getUserContext(userId: string): UserProfile {
  const profile = getUserProfileById(userId)
  if (!profile) {
    throw new Error(`User profile not found for id: ${userId}`)
  }
  return profile
}
