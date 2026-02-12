export const typography = {
  fontFamily: {
    display: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    body: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    mono: 'JetBrains Mono, Menlo, monospace',
  },
  scale: {
    display: {
      fontSize: '3.5rem',
      lineHeight: '1.1',
      letterSpacing: '-0.02em',
      fontWeight: 700,
    },
    h1: {
      fontSize: '2rem',
      lineHeight: '1.2',
      letterSpacing: '-0.01em',
      fontWeight: 600,
    },
    h2: {
      fontSize: '1.5rem',
      lineHeight: '1.3',
      letterSpacing: '-0.01em',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.25rem',
      lineHeight: '1.35',
      letterSpacing: '-0.01em',
      fontWeight: 600,
    },
    bodyLg: {
      fontSize: '1.125rem',
      lineHeight: '1.5',
      letterSpacing: '0em',
      fontWeight: 400,
    },
    body: {
      fontSize: '1rem',
      lineHeight: '1.5',
      letterSpacing: '0em',
      fontWeight: 400,
    },
    caption: {
      fontSize: '0.875rem',
      lineHeight: '1.4',
      letterSpacing: '0em',
      fontWeight: 500,
    },
    overline: {
      fontSize: '0.75rem',
      lineHeight: '1.4',
      letterSpacing: '0.08em',
      fontWeight: 600,
      textTransform: 'uppercase',
    },
  },
} as const;
