export const basePalette = {
  royalPlum: '#832161',
  magentaBloom: '#da4167',
  midnightViolet: '#3d2645',
  black: '#000000',
  ghostWhite: '#f0eff4',
} as const;

export const neutral = {
  50: '#f0eff4',
  100: '#d5d4d9',
  200: '#bbbabe',
  300: '#a1a1a4',
  400: '#88888b',
  500: '#707072',
  600: '#59595b',
  700: '#434344',
  800: '#2e2e2f',
  900: '#1a1a1b',
  950: '#000000',
} as const;

export const primary = {
  50: '#f7f1f5',
  100: '#ded6dd',
  200: '#c6bbc5',
  300: '#aea1ad',
  400: '#978797',
  500: '#806f81',
  600: '#6a576b',
  700: '#554056',
  800: '#402b42',
  900: '#2c162f',
} as const;

export const accent = {
  100: '#fbe9ee',
  200: '#e2b7be',
  300: '#c88691',
  400: '#ab5566',
  500: '#8c1f3e',
} as const;

export const semantic = {
  success: {
    backgroundSubtle: '#d3dedd',
    backgroundStrong: '#aec6bf',
    border: '#92b5a9',
    text: '#2f7d64',
    hover: '#296350',
    icon: '#235041',
  },
  warning: {
    backgroundSubtle: '#eaddd5',
    backgroundStrong: '#e1c4ad',
    border: '#d8b390',
    text: '#b47a2f',
    hover: '#8e6128',
    icon: '#724e22',
  },
  error: {
    backgroundSubtle: '#e9d6db',
    backgroundStrong: '#dfb5ba',
    border: '#d59da2',
    text: '#b04a57',
    hover: '#8b3c46',
    icon: '#703239',
  },
  info: {
    backgroundSubtle: '#d6dae9',
    backgroundStrong: '#b4c0d9',
    border: '#9bacce',
    text: '#3b6ea8',
    hover: '#325784',
    icon: '#2b476a',
  },
} as const;

export const chart = {
  1: '#4E79A7',
  2: '#F28E2B',
  3: '#59A14F',
  4: '#B07AA1',
  5: '#E15759',
  6: '#76B7B2',
  7: '#EDC948',
  8: '#9C755F',
} as const;

export const colorTokens = {
  basePalette,
  neutral,
  primary,
  accent,
  semantic,
  chart,
} as const;
