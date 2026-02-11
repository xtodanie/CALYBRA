import { en } from './en';

export const supportedLocales = ['en', 'es'] as const;
export type Locale = (typeof supportedLocales)[number];
type Translate<T> = {
	[K in keyof T]: T[K] extends string ? string : Translate<T[K]>;
};

export type Dict = Translate<typeof en>;
