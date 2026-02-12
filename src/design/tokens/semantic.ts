import { accent, neutral, primary, semantic } from './colors';

export const semanticTokens = {
  background: neutral[50],
  foreground: neutral[900],
  surface: neutral[50],
  surfaceAlt: neutral[100],
  border: neutral[200],
  primary: primary[600],
  primaryHover: primary[700],
  accent: accent[500],
  focusRing: accent[500],
  success: semantic.success.text,
  warning: semantic.warning.text,
  error: semantic.error.text,
  info: semantic.info.text,
} as const;
