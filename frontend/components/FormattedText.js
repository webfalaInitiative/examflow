import React from 'react';

/**
 * Converts text containing URLs or markdown links into React elements with clickable <a> tags.
 */
export function renderTextWithLinks(text, options = {}) {
  if (!text || typeof text !== 'string') return null;

  // Pattern matches:
  // 1. Markdown links: [anchor text](https://...)
  // 2. Standard URLs: https://... or http://... or www....
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\))|(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    if (match[1]) {
      // Markdown link: [text](url)
      const label = match[2];
      let url = match[3];
      if (url.startsWith('www.')) url = 'https://' + url;
      parts.push(
        <a
          key={`md-link-${matchIndex}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#2563eb',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
            fontWeight: 600,
            wordBreak: 'break-all',
            ...options.linkStyle,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {label} ↗
        </a>
      );
    } else {
      // Bare URL: https://... or www....
      let rawUrl = match[4];
      let trailing = '';
      const trailingPunctuationMatch = rawUrl.match(/[.,;:!?)]+$/);
      if (trailingPunctuationMatch) {
        trailing = trailingPunctuationMatch[0];
        rawUrl = rawUrl.substring(0, rawUrl.length - trailing.length);
      }

      let href = rawUrl;
      if (href.startsWith('www.')) href = 'https://' + href;

      parts.push(
        <a
          key={`url-${matchIndex}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#2563eb',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
            fontWeight: 600,
            wordBreak: 'break-all',
            ...options.linkStyle,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {rawUrl} ↗
        </a>
      );
      if (trailing) {
        parts.push(trailing);
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

/**
 * Checks if a string contains any HTTP or WWW URL
 */
export function hasUrl(text) {
  if (!text || typeof text !== 'string') return false;
  return /(https?:\/\/[^\s]+|www\.[^\s]+|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/i.test(text);
}

/**
 * FormattedText component that preserves whitespace/newlines and makes all links clickable
 */
export default function FormattedText({
  text,
  className = '',
  style = {},
  linkStyle = {},
  fallback = null,
  as: Component = 'div',
}) {
  if (!text) {
    return fallback ? <Component className={className} style={style}>{fallback}</Component> : null;
  }

  return (
    <Component
      className={className}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...style,
      }}
    >
      {renderTextWithLinks(text, { linkStyle })}
    </Component>
  );
}

