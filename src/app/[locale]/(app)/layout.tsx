"use client";

import { useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useT, useLocale } from '@/i18n/provider';
import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Topbar } from '@/components/layout/premium-shell';
import { SIDEBAR_COLLAPSED, SIDEBAR_EXPANDED } from '@/components/layout/layout-constants';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function ProvisioningErrorDisplay() {
  const t = useT();
  const { retryProvisioning, logout } = useAuth();
  
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <h1 className="font-headline text-3xl font-bold tracking-tight">
        {t.auth.provisioning.title}
      </h1>
      <p className="max-w-md text-muted-foreground">
        {t.auth.provisioning.description}
      </p>
      <div className="flex gap-4">
        <Button onClick={() => retryProvisioning()}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t.auth.provisioning.retry}
        </Button>
        <Button variant="outline" onClick={() => logout()}>
          {t.auth.provisioning.logout}
        </Button>
      </div>
    </div>
  );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, provisioningError } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!loading && !user && !provisioningError) {
      router.replace(`/${locale}/login`);
    }
  }, [user, loading, provisioningError, router, locale]);

  if (provisioningError) {
    return <ProvisioningErrorDisplay />;
  }

  if (loading || !user) {
    return (
       <div className="flex h-screen w-full items-center justify-center bg-background">
        <p className="text-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div
      className="h-screen overflow-hidden bg-background text-foreground"
      style={
        {
          '--app-sidebar-collapsed': `${SIDEBAR_COLLAPSED}px`,
          '--app-sidebar-expanded': `${SIDEBAR_EXPANDED}px`,
        } as CSSProperties
      }
    >
      <div className="grid h-full grid-cols-[var(--app-sidebar-collapsed)_1fr] md:grid-cols-[var(--app-sidebar-expanded)_1fr]">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow-elevation-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <AppSidebar />
        <div className="flex min-w-0 flex-col">
          <Topbar>
            <ThemeToggle />
            <LanguageSwitcher />
            <UserNav />
          </Topbar>
          <main id="main-content" className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
