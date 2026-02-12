/**
 * Typewriter Component
 *
 * Cycles through phrases with typing animation.
 * Features:
 * - Configurable typing/deleting speed
 * - Hold duration between phrases
 * - Animated cursor with pulse
 */
"use client";

import React from "react";

interface TypewriterProps {
  /** Array of phrases to cycle through */
  phrases: readonly string[];
  /** Milliseconds per character when typing (default: 28) */
  typeMs?: number;
  /** Milliseconds per character when deleting (default: 18) */
  deleteMs?: number;
  /** Milliseconds to hold before deleting (default: 900) */
  holdMs?: number;
  /** Custom class for the container span */
  className?: string;
  /** Custom cursor character */
  cursor?: string;
}

export function Typewriter({
  phrases,
  typeMs = 28,
  deleteMs = 18,
  holdMs = 900,
  className = "",
  cursor = "▍",
}: TypewriterProps) {
  const [phraseIndex, setPhraseIndex] = React.useState(0);
  const [displayText, setDisplayText] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (phrases.length === 0) return;

    const currentPhrase = phrases[phraseIndex % phrases.length] ?? "";
    const doneTyping = !isDeleting && displayText === currentPhrase;
    const doneDeleting = isDeleting && displayText.length === 0;

    const delay = doneTyping ? holdMs : isDeleting ? deleteMs : typeMs;

    const timeout = setTimeout(() => {
      if (doneTyping) {
        setIsDeleting(true);
      } else if (doneDeleting) {
        setIsDeleting(false);
        setPhraseIndex((idx) => idx + 1);
      } else {
        setDisplayText((current) =>
          isDeleting
            ? current.slice(0, -1)
            : currentPhrase.slice(0, current.length + 1)
        );
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [phrases, phraseIndex, displayText, isDeleting, typeMs, deleteMs, holdMs]);

  return (
    <span className={`font-mono ${className}`}>
      {displayText}
      <span className="ml-1 inline-block w-[0.6ch] animate-pulse" aria-hidden="true">
        {cursor}
      </span>
    </span>
  );
}
