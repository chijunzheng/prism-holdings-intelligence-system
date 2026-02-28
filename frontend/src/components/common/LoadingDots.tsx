import '../../styles/loading-dots.css'

interface LoadingDotsProps {
  readonly className?: string
}

export function LoadingDots({ className = '' }: LoadingDotsProps) {
  return (
    <div className={`loading-dots ${className}`}>
      <span className="loading-dots__dot" />
      <span className="loading-dots__dot" />
      <span className="loading-dots__dot" />
    </div>
  )
}
