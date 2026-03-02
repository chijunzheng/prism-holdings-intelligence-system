// Shared markdown renderer — converts markdown text to React nodes.
// Supports: headings, bold, italic, inline code, links, lists, blockquotes, code blocks, hr.

import { type ReactNode } from 'react'
import { SourceCitation } from './SourceCitation'

function renderInlineMarkdown(content: string, keyPrefix: string): ReadonlyArray<ReactNode> {
  const parts: Array<ReactNode> = []
  const inlineRegex = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null = null
  let tokenIndex = 0

  while ((match = inlineRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    if (match[1] !== undefined) {
      parts.push(<code key={`${keyPrefix}-code-${tokenIndex}`}>{match[1]}</code>)
    } else if (match[2] !== undefined && match[3] !== undefined) {
      parts.push(
        <SourceCitation
          key={`${keyPrefix}-link-${tokenIndex}`}
          title={match[2]}
          url={match[3]}
        />,
      )
    } else if (match[4] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-strong-${tokenIndex}`}>{match[4]}</strong>)
    } else if (match[5] !== undefined) {
      parts.push(<em key={`${keyPrefix}-em-${tokenIndex}`}>{match[5]}</em>)
    }

    tokenIndex += 1
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

function isUnorderedList(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line)
}

function isOrderedList(line: string): boolean {
  return /^\s*\d+\.\s+/.test(line)
}

function stripUnorderedPrefix(line: string): string {
  return line.replace(/^\s*[-*+]\s+/, '')
}

function stripOrderedPrefix(line: string): string {
  return line.replace(/^\s*\d+\.\s+/, '')
}

export function renderMarkdown(content: string): ReadonlyArray<ReactNode> {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: Array<ReactNode> = []
  let i = 0
  let blockIndex = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) i += 1
      blocks.push(
        <pre key={`block-${blockIndex}`} className="chat-message__code-block">
          <code data-language={language || undefined}>{codeLines.join('\n')}</code>
        </pre>,
      )
      blockIndex += 1
      continue
    }

    const headingMatch = line.match(/^\s*(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingContent = renderInlineMarkdown(headingMatch[2], `h-${blockIndex}`)
      if (level === 1) blocks.push(<h1 key={`block-${blockIndex}`}>{headingContent}</h1>)
      else if (level === 2) blocks.push(<h2 key={`block-${blockIndex}`}>{headingContent}</h2>)
      else if (level === 3) blocks.push(<h3 key={`block-${blockIndex}`}>{headingContent}</h3>)
      else if (level === 4) blocks.push(<h4 key={`block-${blockIndex}`}>{headingContent}</h4>)
      else if (level === 5) blocks.push(<h5 key={`block-${blockIndex}`}>{headingContent}</h5>)
      else blocks.push(<h6 key={`block-${blockIndex}`}>{headingContent}</h6>)
      i += 1
      blockIndex += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`block-${blockIndex}`} />)
      i += 1
      blockIndex += 1
      continue
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      blocks.push(
        <blockquote key={`block-${blockIndex}`}>
          {renderInlineMarkdown(quoteLines.join(' '), `q-${blockIndex}`)}
        </blockquote>,
      )
      blockIndex += 1
      continue
    }

    if (isUnorderedList(line)) {
      const items: Array<ReactNode> = []
      while (i < lines.length && isUnorderedList(lines[i])) {
        const itemText = stripUnorderedPrefix(lines[i])
        items.push(
          <li key={`li-${blockIndex}-${items.length}`}>
            {renderInlineMarkdown(itemText, `ul-${blockIndex}-${items.length}`)}
          </li>,
        )
        i += 1
      }
      blocks.push(<ul key={`block-${blockIndex}`}>{items}</ul>)
      blockIndex += 1
      continue
    }

    if (isOrderedList(line)) {
      const items: Array<ReactNode> = []
      while (i < lines.length && isOrderedList(lines[i])) {
        const itemText = stripOrderedPrefix(lines[i])
        items.push(
          <li key={`li-${blockIndex}-${items.length}`}>
            {renderInlineMarkdown(itemText, `ol-${blockIndex}-${items.length}`)}
          </li>,
        )
        i += 1
      }
      blocks.push(<ol key={`block-${blockIndex}`}>{items}</ol>)
      blockIndex += 1
      continue
    }

    const paragraphLines: string[] = []
    while (i < lines.length) {
      const next = lines[i]
      const nextTrim = next.trim()
      if (!nextTrim) break
      if (
        nextTrim.startsWith('```') ||
        /^\s*(#{1,6})\s+/.test(next) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrim) ||
        /^\s*>/.test(next) ||
        isUnorderedList(next) ||
        isOrderedList(next)
      ) {
        break
      }
      paragraphLines.push(next)
      i += 1
    }
    const paragraphNodes: Array<ReactNode> = []
    paragraphLines.forEach((paragraphLine, index) => {
      paragraphNodes.push(...renderInlineMarkdown(paragraphLine, `p-${blockIndex}-${index}`))
      if (index < paragraphLines.length - 1) {
        paragraphNodes.push(<br key={`p-br-${blockIndex}-${index}`} />)
      }
    })
    blocks.push(<p key={`block-${blockIndex}`}>{paragraphNodes}</p>)
    blockIndex += 1
  }

  return blocks
}
