import { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../../contexts/AppContext'

export function ProfileSwitcher() {
  const { userId, profiles, profilesLoading, setUserId, loadProfiles } = useAppContext()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (profilesLoading || profiles.length === 0) return null

  const currentProfile = profiles.find((p) => p.id === userId)
  const initials = currentProfile
    ? currentProfile.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  return (
    <div className="ws-profile" ref={ref}>
      <button
        className="ws-profile__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="ws-profile__avatar">{initials}</span>
        <svg
          className={`ws-profile__chevron ${isOpen ? 'ws-profile__chevron--open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="ws-profile__dropdown">
          <div className="ws-profile__header">
            <span className="ws-profile__header-avatar">{initials}</span>
            <div className="ws-profile__header-info">
              <span className="ws-profile__header-name">{currentProfile?.name}</span>
              <span className="ws-profile__header-context">{currentProfile?.context}</span>
            </div>
          </div>

          <div className="ws-profile__divider" />

          <div className="ws-profile__section-label">Switch Persona</div>
          {profiles.map((p) => (
            <button
              key={p.id}
              className={`ws-profile__item ${p.id === userId ? 'ws-profile__item--active' : ''}`}
              onClick={() => {
                setUserId(p.id)
                setIsOpen(false)
              }}
            >
              <span className="ws-profile__item-avatar">
                {p.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
              <div className="ws-profile__item-info">
                <span className="ws-profile__item-name">{p.name}</span>
                <span className="ws-profile__item-context">{p.shortContext ?? p.context}</span>
              </div>
              {p.id === userId && (
                <svg
                  className="ws-profile__check"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
