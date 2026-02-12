import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster"
import '../globals.css';
import { cn } from '@/lib/utils';
import { Locale, supportedLocales } from '@/i18n/types';
import { LocaleProvider } from '@/i18n/provider';
import { AuthProvider } from '@/hooks/use-auth';

export async function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: 'Calybra',
  description: 'Monthly bank & supplier-invoice reconciliation for modern businesses.',
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const resolvedLocale = supportedLocales.includes(locale as Locale)
    ? (locale as Locale)
    : supportedLocales[0];
  return (
    <html lang={resolvedLocale} className="dark">
      <body
        className={cn(
          "font-sans antialiased",
          inter.variable,
          spaceGrotesk.variable,
          jetbrainsMono.variable
        )}
      >
        <AuthProvider>
          <LocaleProvider locale={resolvedLocale}>
            {children}
          </LocaleProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
