import React from "react";
import Image from "next/image";
import { emojiToAnimatedPath } from "@/config/emoji-to-animated-path";

// Very small "markdown-like" support with highlighting:
// - Line breaks: "\n" (multiple preserved)
// - Bold: **text**
// - Italic: *text* or _text_
// - Underline: __text__
// - Strikethrough: ~~text~~
// - Spoiler: ||text||
// - Highlight: ==text==
// - Inline code: `text` (no highlight, monospace)
// - Links: http(s)://..., www...., or bare domains like example.com/foo
const HIGHLIGHT_CLASS = "text-primary bg-primary/5 py-0.5 outline-none";

const makeUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

// For display: strip "http://" or "https://" only from the shown text
const displayUrl = (raw: string): string => {
  return raw.replace(/^https?:\/\//i, "");
};

// Build animated emoji URL safely (no "undefined" base)
const getAnimatedEmojiSrc = (mappedFilename: string): string => {
  // Next.js exposes only NEXT_PUBLIC_* vars to the browser
  const rawBase = process.env.NEXT_PUBLIC_ANIMATED_EMOJIES_ENDPOINT ?? "";

  // Allow either "http://host:port" or "" (relative)
  const base = rawBase.replace(/\/+$/, ""); // trim trailing slashes
  const path = `/animated-emojies/${mappedFilename}`;

  return base ? `${base}${path}` : path;
};

export const renderSimpleMarkdown = (
  content: string | null | undefined
): React.ReactNode => {
  if (!content) return "— no content —";

  // We split on single "\n" but keep empty lines as <br/> to support multiple \n\n
  const lines = content.split("\n");

  return (
    <div className="whitespace-pre-wrap break-words">
      {lines.map((line, lineIndex) => (
        <div key={lineIndex}>
          {line === "" ? (
            // Empty line -> explicit line break to preserve multiple newlines
            <br />
          ) : (
            renderInline(line)
          )}
        </div>
      ))}
    </div>
  );
};

// Render inline markdown-like syntax & links within one line
const renderInline = (text: string): React.ReactNode => {
  // Order: code first (we don't parse formatting inside code)
  const codeSplit = splitWithDelimiters(text, /(`[^`]+`)/g);

  return codeSplit.map((segment, i) => {
    const codeMatch = segment.match(/^`([^`]+)`$/);
    if (codeMatch) {
      return (
        <code
          key={`code-${i}`}
          className="font-mono text-xs px-1 py-0.5 rounded bg-secondary/20"
        >
          {codeMatch[1]}
        </code>
      );
    }

    // For non-code segments, apply formatting + links
    return (
      <React.Fragment key={`seg-${i}`}>
        {renderFormattedAndLinks(segment)}
      </React.Fragment>
    );
  });
};

// Apply formatting (bold/italic/etc) and link detection inside a non-code segment
const renderFormattedAndLinks = (text: string): React.ReactNode => {
  if (!text) return null;

  // Combined pattern for all supported markers, longest first to avoid conflicts
  const formatRegex =
    /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\|\|[^|]+\|\||==[^=]+==|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

  const parts = splitWithDelimiters(text, formatRegex);

  return parts.map((part, index) => {
    // Bold: **text**
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <span key={index} className={HIGHLIGHT_CLASS}>
          {renderLinks(boldMatch[1])}
        </span>
      );
    }

    // Underline: __text__
    const underlineMatch = part.match(/^__([^_]+)__$/);
    if (underlineMatch) {
      return (
        <span key={index} className={HIGHLIGHT_CLASS}>
          {renderLinks(underlineMatch[1])}
        </span>
      );
    }

    // Strikethrough: ~~text~~
    const strikeMatch = part.match(/^~~([^~]+)~~$/);
    if (strikeMatch) {
      return (
        <span key={index} className={HIGHLIGHT_CLASS}>
          {renderLinks(strikeMatch[1])}
        </span>
      );
    }

    // Spoiler: ||text||
    const spoilerMatch = part.match(/^\|\|([^|]+)\|\|$/);
    if (spoilerMatch) {
      return (
        <span key={index} className={HIGHLIGHT_CLASS}>
          {renderLinks(spoilerMatch[1])}
        </span>
      );
    }

    // Highlight: ==text==
    const markMatch = part.match(/^==([^=]+)==$/);
    if (markMatch) {
      return (
        <span key={index} className={HIGHLIGHT_CLASS}>
          {renderLinks(markMatch[1])}
        </span>
      );
    }

    // Italic: *text* (no spaces right after * and before *)
    const italicStarMatch = part.match(/^\*([^*\s][^*]*)\*$/);
    if (italicStarMatch) {
      return (
        <span key={index} className={HIGHLIGHT_CLASS}>
          {renderLinks(italicStarMatch[1])}
        </span>
      );
    }

    // Italic: _text_ (no spaces right after _ and before _)
    const italicUnderscoreMatch = part.match(/^_([^_\s][^_]*)_$/);
    if (italicUnderscoreMatch) {
      return (
        <span key={index} className={HIGHLIGHT_CLASS}>
          {renderLinks(italicUnderscoreMatch[1])}
        </span>
      );
    }

    // Plain text => only link detection
    return <React.Fragment key={index}>{renderLinks(part)}</React.Fragment>;
  });
};

// Detect links inside a plain text fragment and make them clickable
const renderLinks = (text: string): React.ReactNode => {
  if (!text) return null;

  // Emoji replacement first (so emoji-only messages or mixed text get converted)
  const emojiRegex =
    /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;
  const emojiParts = splitWithDelimiters(text, emojiRegex);

  return emojiParts.map((chunk, idx) => {
    if (emojiRegex.test(chunk)) {
      emojiRegex.lastIndex = 0;

      const mapped = emojiToAnimatedPath[chunk];
      if (mapped) {
        const src = getAnimatedEmojiSrc(mapped);

        return (
          <Image
            key={`ae-${idx}`}
            src={src}
            unoptimized
            alt={chunk}
            width={20}
            height={20}
            loading="lazy"
            className="inline-flex justify-center items-center w-5 h-5"
            draggable={false}
          />
        );
      }

      return <React.Fragment key={`e-${idx}`}>{chunk}</React.Fragment>;
    }

    // Simple URL matcher:
    // - with protocol: http://..., https://...
    // - or starting with www.
    // - or bare domains like example.com, foo.bar/baz
    const urlRegex =
      /((https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?))/g;

    const parts = splitWithDelimiters(chunk, urlRegex);

    return (
      <React.Fragment key={`t-${idx}`}>
        {parts.map((part, i) => {
          if (urlRegex.test(part)) {
            // reset regex state for next usage
            urlRegex.lastIndex = 0;

            const href = makeUrl(part);
            const shown = displayUrl(part); // strip http(s):// for display only

            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={HIGHLIGHT_CLASS} // no underline
              >
                {shown}
              </a>
            );
          }

          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </React.Fragment>
    );
  });
};

// Helper: split string but keep the delimiters (regex capture groups)
const splitWithDelimiters = (text: string, regex: RegExp): string[] => {
  const result: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  regex.lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      result.push(text.slice(lastIndex, matchIndex));
    }
    result.push(match[0]);
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  // Reset regex for reuse
  regex.lastIndex = 0;
  return result;
};
