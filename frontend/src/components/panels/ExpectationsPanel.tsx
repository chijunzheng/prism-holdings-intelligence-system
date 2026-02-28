// ExpectationsPanel — compact display of user risk preferences.
// Shows risk tolerance, horizon, goals. Edit button for inline form.

import { useEffect, useState } from 'react'
import type { UserProfile } from '@prism/shared'

interface ExpectationsPanelProps {
  readonly userId: string
}

export function ExpectationsPanel({ userId }: ExpectationsPanelProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    fetch(`/api/profiles`)
      .then((res) => res.json())
      .then((payload: { success: boolean; data?: UserProfile[] }) => {
        if (payload.success && payload.data) {
          const match = payload.data.find((p) => p.id === userId)
          if (match) setProfile(match)
        }
      })
      .catch(() => {
        // Silently fail — expectations panel is non-critical
      })
  }, [userId])

  if (!profile) return null

  return (
    <div className="expectations-panel">
      <h3 className="expectations-panel__title">Your Profile</h3>
      <div className="expectations-panel__grid">
        <div className="expectations-panel__item">
          <span className="expectations-panel__label">Risk</span>
          <span className="expectations-panel__value">{profile.riskTolerance}</span>
        </div>
        <div className="expectations-panel__item">
          <span className="expectations-panel__label">Horizon</span>
          <span className="expectations-panel__value">{profile.investmentHorizonYears}y</span>
        </div>
        <div className="expectations-panel__item">
          <span className="expectations-panel__label">Literacy</span>
          <span className="expectations-panel__value">{profile.financialLiteracy}</span>
        </div>
      </div>
      {profile.goals && profile.goals.length > 0 && (
        <div className="expectations-panel__expectations">
          <div className="expectations-panel__item">
            <span className="expectations-panel__label">Goals</span>
            <span className="expectations-panel__value">
              {profile.goals.join(', ')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
