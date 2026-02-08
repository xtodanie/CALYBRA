import type { Metadata } from 'next';
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

export default function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { locale: Locale };
}>) {
  return (
    <html lang={params.locale} className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn(
        "font-body antialiased",
      )}>
        <AuthProvider>
          <LocaleProvider locale={params.locale}>
            {children}
          </LocaleProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
