import { en } from './en';

export const supportedLocales = ['en', 'es'] as const;
export type Locale = (typeof supportedLocales)[number];
export type Dict = typeof en;
