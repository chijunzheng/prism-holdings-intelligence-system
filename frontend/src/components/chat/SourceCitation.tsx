interface SourceCitationProps {
  readonly title: string
  readonly url: string
}

export function SourceCitation({ title, url }: SourceCitationProps) {
  return (
    <a
      className="chat-citation"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
    >
      {title}
    </a>
  )
}
