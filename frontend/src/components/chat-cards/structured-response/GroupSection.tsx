import { useState } from 'react'
import type { GroupSection as GroupSectionData, StructuredSection } from '@prism/shared'

interface GroupSectionProps {
  readonly data: GroupSectionData
  readonly renderSection: (section: StructuredSection, index: number) => React.ReactNode
}

export function GroupSection({ data, renderSection }: GroupSectionProps) {
  const [isOpen, setIsOpen] = useState(data.defaultOpen !== false)

  return (
    <div className="sr__group">
      <button
        className="sr__group-header"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className={`sr__group-chevron ${isOpen ? 'sr__group-chevron--open' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="sr__group-title">{data.title}</span>
      </button>
      {isOpen && (
        <div className="sr__group-content">
          {data.sections.map((child, i) => renderSection(child, i))}
        </div>
      )}
    </div>
  )
}
