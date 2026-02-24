import { useEffect } from 'react'
import { useAppContext } from '../../contexts/AppContext'

export function ProfileSwitcher() {
  const { userId, profiles, profilesLoading, setUserId, loadProfiles } = useAppContext()

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  if (profilesLoading || profiles.length === 0) return null

  return (
    <div className="profile-switcher">
      <label className="profile-switcher__label" htmlFor="profile-select">
        Demo Persona
      </label>
      <select
        id="profile-select"
        className="profile-switcher__select"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.context}
          </option>
        ))}
      </select>
    </div>
  )
}
