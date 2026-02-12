export const tokens = {
  brand: {
    gradient: "linear-gradient(135deg, hsl(283 58% 38%) 0%, hsl(332 68% 55%) 52%, hsl(210 88% 62%) 100%)",
    gradientSoft: "radial-gradient(80% 80% at 10% 0%, hsl(286 75% 56% / 0.22) 0%, hsl(286 75% 56% / 0) 100%), radial-gradient(80% 80% at 90% 0%, hsl(334 80% 62% / 0.18) 0%, hsl(334 80% 62% / 0) 100%)",
  },
  light: {
    surface: {
      base: "252 19% 95%",
      elevated: "0 0% 100%",
      glass: "252 19% 98% / 0.74",
      border: "255 3% 74% / 0.7",
    },
    text: {
      primary: "240 2% 10%",
      secondary: "240 1% 35%",
    },
  },
  dark: {
    surface: {
      base: "248 28% 8%",
      elevated: "248 24% 12%",
      glass: "248 24% 14% / 0.74",
      border: "253 18% 32% / 0.58",
    },
    text: {
      primary: "252 20% 94%",
      secondary: "252 12% 76%",
    },
  },
  elevation: {
    low: "0 1px 2px 0 hsl(240 30% 3% / 0.28)",
    medium: "0 8px 24px -10px hsl(240 30% 3% / 0.45)",
    high: "0 18px 40px -16px hsl(240 40% 2% / 0.58)",
  },
  glow: {
    brand: "0 0 0 1px hsl(286 75% 56% / 0.22), 0 0 36px hsl(286 75% 56% / 0.24)",
    success: "0 0 0 1px hsl(160 42% 46% / 0.24), 0 0 26px hsl(160 42% 46% / 0.26)",
    warning: "0 0 0 1px hsl(34 82% 54% / 0.24), 0 0 26px hsl(34 82% 54% / 0.26)",
    danger: "0 0 0 1px hsl(352 78% 56% / 0.24), 0 0 26px hsl(352 78% 56% / 0.26)",
  },
  status: {
    success: "160 42% 46%",
    warning: "34 82% 54%",
    danger: "352 78% 56%",
    info: "212 74% 58%",
  },
  chart: {
    1: "211 86% 62%",
    2: "292 74% 62%",
    3: "159 64% 46%",
    4: "35 89% 56%",
    5: "350 83% 61%",
    6: "186 70% 45%",
  },
} as const;

export type AppTokens = typeof tokens;
