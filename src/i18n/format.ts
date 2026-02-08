import { Locale } from './types';

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

type DateFormatOptions = {
    year?: 'numeric' | '2-digit';
    month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
    day?: 'numeric' | '2-digit';
}

export function formatDate(date: Date | string | number, locale: Locale, options?: DateFormatOptions): string {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const defaultOptions: DateFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(dateObj);
}
