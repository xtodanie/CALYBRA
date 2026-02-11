import type { Metadata } from 'next';
import { PT_Sans, Space_Grotesk } from 'next/font/google';
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

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
});

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body',
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
          "font-body antialiased",
          spaceGrotesk.variable,
          ptSans.variable
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
